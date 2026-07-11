type Lang = 'zh' | 'en';

const LANG_KEY = 'zyes_lang';

const translations = {
  zh: {
    'login.title': 'zyes',
    'login.subtitle': '书签导航门户',
    'login.password': '密码',
    'login.placeholder': '输入密码',
    'login.submit': '登录',
    'login.logging': '登录中...',
    'login.failed': '登录失败',
    'header.toggleSidebar': '切换侧栏',
    'header.toggleDark': '切换暗色模式',
    'header.logout': '退出登录',
    'header.tagline': '书签导航与聚合搜索',
    'search.placeholder': '搜索...',
    'search.switchEngine': '切换搜索引擎',
    'search.submit': '搜索',
    'sidebar.all': '全部',
    'sidebar.categories': '分类',
    'sidebar.addCategory': '添加分类',
    'sidebar.close': '关闭侧栏',
    'sidebar.edit': '编辑',
    'sidebar.delete': '删除',
    'sidebar.dragCategory': '拖动排序',
    'grid.addCard': '添加卡片',
    'grid.uncategorized': '未分类',
    'grid.empty': '暂无书签，添加你的第一个吧！',
    'grid.open': '打开',
    'grid.edit': '编辑书签',
    'grid.delete': '删除书签',
    'grid.viewCompact': '紧凑',
    'grid.viewDetail': '详情',
    'modal.addBookmark': '添加书签',
    'modal.editBookmark': '编辑书签',
    'modal.title': '标题',
    'modal.titlePlaceholder': '我的书签',
    'modal.url': '链接',
    'modal.urlPlaceholder': 'https://example.com',
    'modal.urlError': '请输入有效的链接',
    'modal.category': '分类',
    'modal.uncategorized': '未分类',
    'modal.description': '描述（可选）',
    'modal.descPlaceholder': '简短描述...',
    'modal.previewFavicon': '预览图标',
    'modal.cancel': '取消',
    'modal.add': '添加',
    'modal.update': '更新',
    'modal.saving': '保存中...',
    'modal.addCategory': '添加分类',
    'modal.editCategory': '编辑分类',
    'modal.categoryName': '名称',
    'modal.categoryPlaceholder': '我的分类',
    'modal.icon': '图标',
    'modal.iconPlaceholder': 'mdi:github 或 https://... 图片链接',
    'modal.iconHintPrefix': '可填 iconify 图标名(如 mdi:github)或图片 URL,留空则自动获取网站图标。浏览',
    'modal.iconHintSuffix': '搜索可用图标。',
    'confirm.deleteCategory': '删除分类',
    'confirm.deleteCategoryMsg': "确定删除 '{name}' 吗？其中的书签将移至未分类。",
    'confirm.deleteBookmark': '删除书签',
    'confirm.deleteBookmarkMsg': "确定删除 '{name}' 吗？",
    'confirm.cancel': '取消',
    'confirm.delete': '删除',
    'confirm.deleting': '删除中...',
  },
  en: {
    'login.title': 'zyes',
    'login.subtitle': 'Bookmark Navigation Portal',
    'login.password': 'Password',
    'login.placeholder': 'Enter your password',
    'login.submit': 'Login',
    'login.logging': 'Logging in...',
    'login.failed': 'Login failed',
    'header.toggleSidebar': 'Toggle sidebar',
    'header.toggleDark': 'Toggle dark mode',
    'header.logout': 'Logout',
    'header.tagline': 'Bookmark navigation & search',
    'search.placeholder': 'Search...',
    'search.switchEngine': 'Switch search engine',
    'search.submit': 'Search',
    'sidebar.all': 'All',
    'sidebar.categories': 'Categories',
    'sidebar.addCategory': 'Add Category',
    'sidebar.close': 'Close sidebar',
    'sidebar.edit': 'Edit',
    'sidebar.delete': 'Delete',
    'sidebar.dragCategory': 'Drag to reorder',
    'grid.addCard': 'Add Card',
    'grid.uncategorized': 'Uncategorized',
    'grid.empty': 'No bookmarks yet. Add your first one!',
    'grid.open': 'Open',
    'grid.edit': 'Edit bookmark',
    'grid.delete': 'Delete bookmark',
    'grid.viewCompact': 'Compact',
    'grid.viewDetail': 'Detail',
    'modal.addBookmark': 'Add Bookmark',
    'modal.editBookmark': 'Edit Bookmark',
    'modal.title': 'Title',
    'modal.titlePlaceholder': 'My Bookmark',
    'modal.url': 'URL',
    'modal.urlPlaceholder': 'https://example.com',
    'modal.urlError': 'Please enter a valid URL',
    'modal.category': 'Category',
    'modal.uncategorized': 'Uncategorized',
    'modal.description': 'Description (optional)',
    'modal.descPlaceholder': 'Short description...',
    'modal.previewFavicon': 'Preview favicon',
    'modal.cancel': 'Cancel',
    'modal.add': 'Add',
    'modal.update': 'Update',
    'modal.saving': 'Saving...',
    'modal.addCategory': 'Add Category',
    'modal.editCategory': 'Edit Category',
    'modal.categoryName': 'Name',
    'modal.categoryPlaceholder': 'My Category',
    'modal.icon': 'Icon',
    'modal.iconPlaceholder': 'mdi:github or https://... image link',
    'modal.iconHintPrefix': 'Enter an iconify icon name (e.g. mdi:github) or an image URL; leave blank to auto-fetch the favicon. Browse ',
    'modal.iconHintSuffix': ' to search icons.',
    'confirm.deleteCategory': 'Delete Category',
    'confirm.deleteCategoryMsg': "Delete '{name}'? Bookmarks will be moved to uncategorized.",
    'confirm.deleteBookmark': 'Delete Bookmark',
    'confirm.deleteBookmarkMsg': "Delete '{name}'?",
    'confirm.cancel': 'Cancel',
    'confirm.delete': 'Delete',
    'confirm.deleting': 'Deleting...',
  },
} as const;

type TranslationKey = keyof typeof translations.zh;

let _lang: Lang = (localStorage.getItem(LANG_KEY) as Lang) || 'zh';

export function getLang(): Lang {
  return _lang;
}

export function setLang(lang: Lang): void {
  _lang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
}

export function toggleLang(): Lang {
  const next = _lang === 'zh' ? 'en' : 'zh';
  setLang(next);
  return next;
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  let text = translations[_lang]?.[key] ?? translations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

document.documentElement.lang = _lang;
