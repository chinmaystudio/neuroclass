import { runMaterialIngestion } from '../services/materialIngestion';

async function main() {
  const summary = await runMaterialIngestion(1);
  console.log(JSON.stringify(summary));
}

void main().catch((error) => {
  const safe = error && typeof error === 'object' ? { message: error.message, code: error.code, details: error.details } : { message: String(error) };
  console.error(JSON.stringify(safe));
  process.exitCode = 1;
});
