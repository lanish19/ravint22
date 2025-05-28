
import { config } from 'dotenv';
config();

import '@/ai/flows/devils-advocate-agent.ts';
import '@/ai/flows/premortem-agent.ts';
import '@/ai/flows/responder-agent.ts';
import '@/ai/flows/critic-agent.ts';
import '@/ai/flows/researcher-agent.ts';
import '@/ai/flows/counter-evidence-researcher-agent.ts'; // Added new counter-evidence researcher
import '@/ai/flows/assumption-analyzer-agent.ts';
import '@/ai/flows/information-gap-agent.ts';
import '@/ai/flows/orchestrator-agent.ts';
import '@/ai/flows/synthesis-agent.ts';

