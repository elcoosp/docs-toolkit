export interface ChangelogConfig {
  repo: string;
  changelogPath?: string;
  pagePath?: string;
  rssPath?: string;
  sidebarLabel?: string;
  pageTitle?: string;
  description?: string;
  disableRss?: boolean;
  disablePage?: boolean;
}

export interface Release {
  version: string;
  date: string;
  body: string;
  link: string;
}
