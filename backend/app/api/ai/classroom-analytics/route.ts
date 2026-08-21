import { handleX402AiRequest } from '../../../../services/x402AiApp';
import { x402OptionsResponse } from '../../../../services/x402Routes';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return handleX402AiRequest(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return x402OptionsResponse(request);
}
