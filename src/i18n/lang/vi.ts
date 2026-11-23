import type { UIStrings } from "../types";

export default {
  nav: {
    home: "Trang chủ",
    posts: "Bài viết",
    topics: "Topics",
    tags: "Tags",
    about: "Giới thiệu",
    archives: "Lưu trữ",
    search: "Tìm kiếm",
  },
  post: {
    publishedAt: "Đăng ngày",
    updatedAt: "Cập nhật",
    sharePostIntro: "Chia sẻ bài viết:",
    sharePostOn: "Chia sẻ bài viết lên {{platform}}",
    sharePostViaEmail: "Chia sẻ bài viết qua email",
    tagLabel: "Tags",
    backToTop: "Lên đầu trang",
    tableOfContents: "Mục lục",
    goBack: "Quay lại",
    editPage: "Sửa trang",
    previousPost: "Bài trước",
    nextPost: "Bài tiếp theo",
  },
  pagination: {
    prev: "Trước",
    next: "Sau",
    page: "Trang",
  },
  home: {
    heroTitle: "Kho Kiến Thức Kỹ Thuật",
    heroIntro:
      "Tổng hợp ghi chú kỹ thuật, kiến trúc hệ thống và playbook thực chiến về Claude CLI & Multi-Agent, quy trình phần mềm (SDLC), Backend Senior, Database, Hệ thống & Server, AWS Cloud và RAG / Code Intelligence.",
    heroSub: "Khám phá theo cây thư mục tại",
    browseTopics: "Knowledge Map",
    socialLinks: "Liên kết",
    featured: "Nổi bật",
    recentPosts: "Bài viết gần đây",
    allPosts: "Tất cả bài viết",
  },
  footer: {
    copyright: "Bản quyền",
    allRightsReserved: "Đã đăng ký bản quyền.",
  },
  pages: {
    tagTitle: "Tag",
    tagDesc: "Tất cả bài viết thuộc thẻ",

    tagsTitle: "Tags",
    tagsDesc: "Tất cả thẻ được sử dụng trong bài viết.",

    postsTitle: "Bài viết",
    postsDesc: "Toàn bộ các bài viết đã đăng.",
    viewByTopics: "Xem theo cây thư mục (Topics) →",

    archivesTitle: "Lưu trữ",
    archivesDesc: "Tất cả bài viết được sắp xếp theo thời gian.",

    searchTitle: "Tìm kiếm",
    searchDesc: "Tìm kiếm toàn văn nội dung bài viết...",
  },
  topics: {
    title: "Topics",
    pageTitle: "Knowledge Map",
    pageDesc:
      "Toàn bộ {{count}} bài viết được sắp xếp theo cây thư mục để bạn nhìn tổng quan và mở nhanh.",
    filterPlaceholder: "Lọc nhanh bài viết theo tiêu đề, tên file hoặc tag...",
    tocLabel: "Mục lục Topics",
    backToTop: "↑ Lên đầu trang",
    articleCount: "{{count}} bài",
    viewPostsList: "← Xem dạng danh sách thẻ bài viết (Posts)",
  },
  sidebar: {
    allTopicsLink: "← Xem toàn bộ Knowledge Map",
    knowledgeMapLink: "← Knowledge Map",
  },
  searchModal: {
    ariaLabel: "Tìm kiếm nhanh",
    placeholder: "Tìm bài viết, chủ đề, tag... (hỗ trợ không dấu)",
    closeLabel: "Đóng tìm kiếm",
    resultsLabel: "Kết quả tìm kiếm",
    hintSelect: "chọn",
    hintOpen: "mở",
    hintClose: "đóng",
    fullTextLink: "Tìm toàn văn (Pagefind) →",
    emptyPrompt: "Nhập từ khóa để tìm bài viết, đề mục hoặc tag.",
    noResults: "Không tìm thấy bài viết phù hợp.",
    loading: "Đang tải chỉ mục tìm kiếm...",
    error: "Không thể tải chỉ mục tìm kiếm.",
  },
  langSwitch: {
    label: "Chuyển ngôn ngữ",
    switchTo: "Switch to English",
  },
  a11y: {
    skipToContent: "Bỏ qua đến nội dung",
    skipTableOfContents: "Bỏ qua mục lục",
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
    toggleTheme: "Đổi giao diện sáng/tối",
    searchPlaceholder: "Tìm bài viết...",
    noResults: "Không có kết quả",
    goToPreviousPage: "Trang trước",
    goToNextPage: "Trang sau",
  },
  notFound: {
    title: "404 Không tìm thấy",
    message: "Không tìm thấy trang",
    goHome: "Về trang chủ",
  },
} satisfies UIStrings;
