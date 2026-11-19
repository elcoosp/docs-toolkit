import * as si from 'simple-icons';

export interface AiProviderSpec {
  id: string;
  name: string;
  tag: string;
  labels: string[];
  pathname: string;
  param: string;
  extra?: Record<string, string>;
  path: string;
}

const OPENAI_PATH =
  'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.476 4.476 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z';
const pickIcon = (key: string, fallback = OPENAI_PATH): string => (si as any)[key]?.path ?? fallback;

export const AI_PROVIDERS: AiProviderSpec[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    tag: 'OpenAI',
    labels: ['chatgpt', 'com'],
    pathname: '/',
    param: 'q',
    path: OPENAI_PATH,
  },
  {
    id: 'claude',
    name: 'Claude',
    tag: 'Anthropic',
    labels: ['claude', 'ai'],
    pathname: '/new',
    param: 'q',
    path: pickIcon('siClaude'),
  },
  {
    id: 'gemini',
    name: 'Gemini',
    tag: 'Google',
    labels: ['www', 'google', 'com'],
    pathname: '/search',
    param: 'q',
    extra: { udm: '50' },
    path: pickIcon('siGooglegemini'),
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    tag: 'Search',
    labels: ['www', 'perplexity', 'ai'],
    pathname: '/search/new',
    param: 'q',
    path: pickIcon('siPerplexity'),
  },
  {
    id: 'grok',
    name: 'Grok',
    tag: 'xAI',
    labels: ['grok', 'com'],
    pathname: '/',
    param: 'q',
    path: pickIcon('siX'),
  },
  {
    id: 'lechat',
    name: 'Le Chat',
    tag: 'Mistral',
    labels: ['chat', 'mistral', 'ai'],
    pathname: '/chat',
    param: 'q',
    path: pickIcon('siMistralai'),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tag: 'Reasoning',
    labels: ['chat', 'deepseek', 'com'],
    pathname: '/',
    param: 'q',
    path: pickIcon('siDeepseek'),
  },
  {
    id: 'qwen',
    name: 'Qwen',
    tag: 'Alibaba',
    labels: ['chat', 'qwen', 'ai'],
    pathname: '/',
    param: 'q',
    path: pickIcon('siQwen'),
  },
  {
    id: 'copilot',
    name: 'Copilot',
    tag: 'Microsoft',
    labels: ['copilot', 'microsoft', 'com'],
    pathname: '/',
    param: 'q',
    path: pickIcon('siGithubcopilot'),
  },
  {
    id: 'huggingchat',
    name: 'HuggingChat',
    tag: 'Open Models',
    labels: ['huggingface', 'co'],
    pathname: '/chat/',
    param: 'prompt',
    path: pickIcon('siHuggingface'),
  },
  {
    id: 'meta',
    name: 'Meta AI',
    tag: 'Llama',
    labels: ['www', 'meta', 'ai'],
    pathname: '/',
    param: 'q',
    path: pickIcon('siMeta'),
  },
  {
    id: 'duckai',
    name: 'Duck.ai',
    tag: 'Private',
    labels: ['duckduckgo', 'com'],
    pathname: '/',
    param: 'q',
    extra: { ia: 'chat' },
    path: pickIcon('siDuckduckgo'),
  },
];

export function buildAiProviderHref(
  spec: Pick<AiProviderSpec, 'labels' | 'pathname' | 'param' | 'extra'>,
  targetPageUrl: string,
): string {
  const params = new URLSearchParams();
  if (spec.extra) {
    for (const [k, v] of Object.entries(spec.extra)) params.set(k, v);
  }
  params.set(spec.param, `Read and summarize this documentation: ${targetPageUrl}`);
  const origin = ['https:', '', spec.labels.join('.')].join('/');
  return origin + spec.pathname + '?' + params.toString();
}
