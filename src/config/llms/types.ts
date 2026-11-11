export interface PageEntry {
  slug: string;
  route: string;
  markdownRoute: string;
  title: string;
  description: string;
  type: string;
  order: number;
  section: string;
  body: string;
}

export interface LlmsTxtConfig {
  title?: string;
  description?: string;
  url?: string;
  source?: string;
  sets?: Array<{ label: string; paths: string[]; description?: string }>;
  exclude?: string[];
  optional?: string[];
  outputs?: {
    index?: boolean;
    full?: boolean;
    small?: boolean;
    json?: boolean;
    pages?: boolean;
    robots?: boolean;
    headLink?: boolean;
  };
}

export interface ResolvedLlmsConfig extends Required<Omit<LlmsTxtConfig, 'outputs'>> {
  outputs: Required<NonNullable<LlmsTxtConfig['outputs']>>;
}
