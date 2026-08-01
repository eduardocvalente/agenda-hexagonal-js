// Teste de carga com k6 — mede antes de otimizar.
//
//   k6 run -e BASE_URL=https://staging.exemplo.com.br tests/load/smoke.js
//
// Os thresholds são o contrato: se a p95 ou a taxa de erro estourarem, o k6
// sai com código diferente de zero e o pipeline falha.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const homeLatency = new Trend('home_latency');
const loginPageLatency = new Trend('login_page_latency');
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Sobe carga aos poucos para achar o ponto de degradação em vez de
    // simplesmente derrubar o serviço.
    rampa: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    // Health check precisa ser barato mesmo sob carga: se ele degrada,
    // o orquestrador começa a matar instâncias saudáveis.
    'http_req_duration{endpoint:health}': ['p(99)<200'],
  },
};

export default function () {
  group('paginas publicas', () => {
    const home = http.get(`${BASE_URL}/`, { tags: { endpoint: 'home' } });
    homeLatency.add(home.timings.duration);
    const homeOk = check(home, {
      'home responde 200': (r) => r.status === 200,
      'home nao vaza contatos para anonimo': (r) => !r.body.includes('<table'),
    });
    errorRate.add(!homeOk);

    const login = http.get(`${BASE_URL}/login/index`, { tags: { endpoint: 'login' } });
    loginPageLatency.add(login.timings.duration);
    errorRate.add(
      !check(login, {
        'login responde 200': (r) => r.status === 200,
        'formulario traz token CSRF': (r) => r.body.includes('name="_csrf"'),
      })
    );
  });

  group('health', () => {
    const health = http.get(`${BASE_URL}/healthz`, { tags: { endpoint: 'health' } });
    errorRate.add(!check(health, { 'healthz ok': (r) => r.status === 200 }));
  });

  sleep(1);
}
