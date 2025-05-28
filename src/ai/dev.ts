import { config } from 'dotenv';
config();

import '@/ai/flows/devils-advocate-agent.ts';
import '@/ai/flows/premortem-agent.ts';
import '@/ai/flows/responder-agent.ts';
import '@/ai/flows/critic-agent.ts';
import '@/ai/flows/researcher-agent.ts';
import '@/ai/flows/assumption-analyzer-agent.ts';
import '@/ai/flows/orchestrator-agent.ts';