export interface UIStrings {
  nav: {
    home: string;
    posts: string;
    topics: string;
    tags: string;
    about: string;
    archives: string;
    search: string;
  };
  post: {
    publishedAt: string;
    updatedAt: string;
    sharePostIntro: string;
    sharePostOn: string;
    sharePostViaEmail: string;
    tagLabel: string;
    backToTop: string;
    /** Optional until v8, so older locale files still type-check. */
    tableOfContents?: string;
    goBack: string;
    editPage: string;
    previousPost: string;
    nextPost: string;
  };
  pagination: {
    prev: string;
    next: string;
    page: string;
  };
  home: {
    heroTitle: string;
    heroIntro: string;
    heroSub: string;
    browseTopics: string;
    socialLinks: string;
    featured: string;
    recentPosts: string;
    allPosts: string;
  };
  footer: {
    copyright: string;
    allRightsReserved: string;
  };
  pages: {
    tagTitle: string;
    tagDesc: string;

    tagsTitle: string;
    tagsDesc: string;

    postsTitle: string;
    postsDesc: string;
    viewByTopics: string;

    archivesTitle: string;
    archivesDesc: string;

    searchTitle: string;
    searchDesc: string;
  };
  topics: {
    title: string;
    pageTitle: string;
    pageDesc: string;
    filterPlaceholder: string;
    tocLabel: string;
    backToTop: string;
    articleCount: string;
    viewPostsList: string;
  };
  sidebar: {
    allTopicsLink: string;
    knowledgeMapLink: string;
  };
  searchModal: {
    ariaLabel: string;
    placeholder: string;
    closeLabel: string;
    resultsLabel: string;
    hintSelect: string;
    hintOpen: string;
    hintClose: string;
    fullTextLink: string;
    emptyPrompt: string;
    noResults: string;
    loading: string;
    error: string;
  };
  langSwitch: {
    label: string;
    switchTo: string;
  };
  a11y: {
    skipToContent: string;
    /** Optional until v8, so older locale files still type-check. */
    skipTableOfContents?: string;
    openMenu: string;
    closeMenu: string;
    toggleTheme: string;
    searchPlaceholder: string;
    noResults: string;
    goToPreviousPage: string;
    goToNextPage: string;
  };
  notFound: {
    title: string;
    message: string;
    goHome: string;
  };
}
