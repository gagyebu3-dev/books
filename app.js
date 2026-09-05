const GENRES = [
  { name: "부동산", color: "#A5874A" },
  { name: "경매", color: "#A5A14A" },
  { name: "법인", color: "#8EA54A" },
  { name: "경제", color: "#74A54A" },
  { name: "뇌과학", color: "#59A54A" },
  { name: "심리학", color: "#4AA555" },
  { name: "자기관리", color: "#4AA56F" },
  { name: "마음관리", color: "#4AA58A" },
  { name: "대화법", color: "#4AA5A4" },
  { name: "독서법", color: "#4A8BA5" },
  { name: "시간관리", color: "#4A70A5" },
  { name: "지정학", color: "#4A56A5" },
  { name: "세계사", color: "#584AA5" },
  { name: "세계지리", color: "#734AA5" },
  { name: "한국사", color: "#8D4AA5" },
  { name: "운동", color: "#A54AA2" },
  { name: "주식", color: "#A54A88" },
  { name: "유튜브", color: "#A54A6D" },
  { name: "만화", color: "#A54A52" },
  { name: "육아", color: "#A55C4A" },
];

// 예전 장르명 -> 새 장르명 자동 이관 (기존에 저장된 책 데이터 보정용)
const GENRE_RENAME_MAP = {
  "역사": "육아",
};

const STATUSES = [
  { key: "wish", label: "읽고 싶은 책" },
  { key: "reading", label: "읽는 중" },
  { key: "done", label: "다 읽음" },
];

// 책 추가 화면의 상태 선택 드롭다운 전용 순서 (책장 그룹핑 순서는 그대로 유지)
const STATUS_FORM_ORDER = ["done", "reading", "wish"];

const REREAD_STATUSES = [
  { key: "planned", label: "재독예정" },
  { key: "done", label: "재독완료" },
  { key: "none", label: "재독안함" },
];

function rereadStatusLabel(key) {
  return (REREAD_STATUSES.find((r) => r.key === key) || {}).label || "";
}

const REREAD_COLORS = {
  1: "#2A2420", // 기본색
  2: "#C7960B", // 노란색
  3: "#3F8F4A", // 초록색
  4: "#3672B0", // 파란색
  5: "#C1453F", // 빨간색
};
const REREAD_TRAINING_COLOR = "#8A5FBF"; // 독서훈련 전용 색
const REREAD_TRAINING = "training";

const STORAGE_KEY = "my-bookshelf-books";
const MAX_COVER_WIDTH = 480;

const state = {
  books: [],
  view: "shelf",
  listSort: "recent", // recent | year | rating
  searchQuery: "",
  detail: null,
  editing: null,
  confirmDeleteId: null,
};

function getSearchedBooks() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) return state.books;
  return state.books.filter(
    (b) => (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q)
  );
}

function genreColor(name) {
  return (GENRES.find((g) => g.name === name) || { color: "#8A8275" }).color;
}

function statusLabel(key) {
  return (STATUSES.find((s) => s.key === key) || {}).label || key;
}

function rereadLabel(n) {
  return n === REREAD_TRAINING ? "독서훈련" : `${n}회독`;
}

function rereadColor(n) {
  return n === REREAD_TRAINING ? REREAD_TRAINING_COLOR : (REREAD_COLORS[n] || REREAD_COLORS[1]);
}

// 배지 등에 "표시할 만한" 재독인지 판단 (1회독은 표시 안 함, 2회독 이상이거나 독서훈련이면 표시)
function isNotableReread(v) {
  return v === REREAD_TRAINING || (Number(v) >= 2);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// 시작일~완료일을 사람이 읽기 좋은 기간 문자열로 변환
// 1개월 미만: n일 / 1개월 이상~1년 미만: n개월 n일 / 1년 이상: n년 n개월 n일
function calcDuration(startStr, endStr) {
  if (!startStr || !endStr) return "";
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return "";

  const totalDaysInclusive = Math.round((end - start) / 86400000) + 1;

  if (totalDaysInclusive < 30) {
    return `${totalDaysInclusive}일`;
  }

  const effEnd = new Date(end);
  effEnd.setDate(effEnd.getDate() + 1);

  let years = effEnd.getFullYear() - start.getFullYear();
  let months = effEnd.getMonth() - start.getMonth();
  let days = effEnd.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(effEnd.getFullYear(), effEnd.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years >= 1) {
    return `${years}년 ${months}개월 ${days}일`;
  }
  return `${months}개월 ${days}일`;
}

// 이미지를 읽어서 적당한 크기로 압축한 뒤 base64 dataURL로 반환
function readAndCompressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_COVER_WIDTH / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.books = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.books = [];
    showError("저장된 데이터를 불러오지 못했어요.");
    return;
  }
  // 예전 데이터 보정: 장르명 변경, '재독중' 상태 제거, 재독완료 체크박스 -> 재독상태 선택으로 이관
  let migrated = false;
  state.books = state.books.map((b) => {
    let nb = b;
    if (GENRE_RENAME_MAP[nb.genre]) {
      nb = { ...nb, genre: GENRE_RENAME_MAP[nb.genre] };
      migrated = true;
    }
    if (nb.status === "rereading") {
      nb = { ...nb, status: "reading" };
      migrated = true;
    }
    if (nb.rereadStatus === undefined) {
      nb = { ...nb, rereadStatus: nb.rereadDone ? "done" : "none" };
      migrated = true;
    }
    if (nb.isEbook === undefined) {
      nb = { ...nb, isEbook: false };
      migrated = true;
    }
    return nb;
  });
  if (migrated) saveBooks();
}

function saveBooks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books));
    flashSaving();
  } catch (e) {
    showError("저장에 실패했어요. 이미지 용량이 크면 저장 공간이 부족할 수 있어요.");
  }
}

let savingTimer = null;
function flashSaving() {
  const tag = document.getElementById("saving-tag");
  tag.classList.remove("hidden");
  clearTimeout(savingTimer);
  savingTimer = setTimeout(() => tag.classList.add("hidden"), 700);
}

function showError(msg) {
  showBanner(msg, "error");
}

function showSuccess(msg) {
  showBanner(msg, "success");
}

function showBanner(msg, type) {
  const banner = document.getElementById("error-banner");
  banner.textContent = msg;
  banner.className = "error-banner" + (type === "success" ? " banner-success" : "");
  setTimeout(() => banner.classList.add("hidden"), 4000);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "disabled") { if (v) node.setAttribute("disabled", "disabled"); }
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function render() {
  renderStats();
  renderTabs();
  const root = document.getElementById("book-view");
  root.innerHTML = "";

  const searched = getSearchedBooks();

  if (state.books.length === 0) {
    root.appendChild(
      el("div", { class: "empty" }, [
        el("p", { text: "아직 꽂힌 책이 없어요." }),
        el("p", { class: "hint", text: "첫 책을 추가하면 여기 책장에 꽂혀요." }),
        el("button", { class: "btn-primary", onclick: openAddForm, text: "+ 책 추가" }),
      ])
    );
  } else if (searched.length === 0) {
    root.appendChild(
      el("div", { class: "empty" }, [
        el("p", { text: "검색 결과가 없어요." }),
        el("p", { class: "hint", text: "제목이나 저자를 다시 확인해 주세요." }),
      ])
    );
  } else if (state.view === "shelf") {
    root.appendChild(renderShelf(searched));
  } else {
    root.appendChild(renderList(searched));
  }

  renderDetail();
  renderConfirm();
}

function renderStats() {
  const total = state.books.length;
  const done = state.books.filter((b) => b.status === "done").length;
  const pages = state.books
    .filter((b) => b.status === "done")
    .reduce((s, b) => s + (Number(b.pages) || 0), 0);
  document.getElementById("stats-text").textContent = `총 ${total}권 · 완독 ${done}권 · ${pages.toLocaleString()}쪽 읽음`;
}

function renderTabs() {
  document.getElementById("tab-shelf").classList.toggle("active", state.view === "shelf");
  document.getElementById("tab-list").classList.toggle("active", state.view === "list");
}

function renderShelf(books) {
  const wrap = el("div", { class: "shelf-wrap" });
  STATUSES.forEach((s) => {
    const items = books.filter((b) => b.status === s.key);
    if (items.length === 0) return;
    const section = el("section", { class: "shelf-section" });
    section.appendChild(
      el("h2", { class: "shelf-label" }, [s.label + " ", el("span", { class: "shelf-count", text: String(items.length) })])
    );

    // 완료일 기준 연도별로 소분류 (완료일이 없는 책은 맨 뒤에 별도로 모아서 표시)
    const withYear = {};
    const noYear = [];
    items.forEach((b) => {
      if (b.finishDate) {
        const y = b.finishDate.slice(0, 4);
        (withYear[y] = withYear[y] || []).push(b);
      } else {
        noYear.push(b);
      }
    });
    const years = Object.keys(withYear).sort((a, b) => b.localeCompare(a));

    years.forEach((year) => {
      section.appendChild(
        el("h3", { class: "shelf-year-label" }, [`${year}년 `, el("span", { class: "shelf-count", text: `${withYear[year].length}권` })])
      );
      section.appendChild(buildShelfRow(withYear[year]));
    });
    if (noYear.length > 0) {
      if (years.length > 0) {
        section.appendChild(el("h3", { class: "shelf-year-label" }, [`연도 미정 `, el("span", { class: "shelf-count", text: `${noYear.length}권` })]));
      }
      section.appendChild(buildShelfRow(noYear));
    }

    section.appendChild(el("div", { class: "ledge" }));
    wrap.appendChild(section);
  });
  return wrap;
}

function buildShelfRow(items) {
  const row = el("div", { class: "shelf-row" });
  items.forEach((b) => {
    const baseWidth = Math.min(64, Math.max(22, (Number(b.pages) || 120) / 9));
    const height = 180;
    const hasBadge = b.status !== "wish" && isNotableReread(b.rereadCount);
    const badgeSpace = hasBadge ? 40 : 0;
    const availableHeight = Math.max(20, height - 30 - badgeSpace);
    const factor = 1.35;
    const titleLen = Math.max(1, b.title.length);

    let columns = 1;
    let fontSize = Math.max(6, Math.min(11, availableHeight / (titleLen * factor)));
    // 1단으로는 아무리 글자를 줄여도 안 들어가면 2단으로 나눠서 표기
    if (titleLen * 6 * factor > availableHeight) {
      columns = 2;
      const perCol = Math.ceil(titleLen / 2);
      fontSize = Math.max(6, Math.min(12, availableHeight / (perCol * factor)));
    }

    const width = columns === 2 ? baseWidth + Math.ceil(fontSize * 1.2) + 6 : baseWidth;
    const topRatedOutline = b.rating === 5 ? "outline:3px solid #3672B0;outline-offset:1px;" : "";

    const spine = el(
      "button",
      {
        class: "spine",
        style: `width:${width}px;height:${height}px;background:linear-gradient(180deg, ${genreColor(b.genre)} 0%, ${shade(genreColor(b.genre), -18)} 100%);${topRatedOutline}`,
        title: b.title,
        onclick: () => openDetail(b.id),
      },
      []
    );

    if (columns === 1) {
      spine.appendChild(
        el("span", { class: "spine-title-col", style: `font-size:${fontSize}px;max-height:${availableHeight}px;`, text: b.title })
      );
    } else {
      // 자동 줄바꿈에 맡기면 글자 사이 간격이 늘어지므로, 직접 두 덩어리로 나눠 각각 독립된 세로줄로 표시
      const mid = Math.ceil(b.title.length / 2);
      const chunk1 = b.title.slice(0, mid);
      const chunk2 = b.title.slice(mid);
      const multiWrap = el("div", { class: "spine-title-multi" }, [
        el("span", { class: "spine-title-col", style: `font-size:${fontSize}px;max-height:${availableHeight}px;`, text: chunk1 }),
        el("span", { class: "spine-title-col", style: `font-size:${fontSize}px;max-height:${availableHeight}px;`, text: chunk2 }),
      ]);
      spine.appendChild(multiWrap);
    }

    if (hasBadge) {
      spine.appendChild(
        el("span", { class: "spine-reread-badge", style: `color:${rereadColor(b.rereadCount)}`, text: rereadLabel(b.rereadCount) })
      );
    }
    row.appendChild(spine);
  });
  return row;
}

function renderList(books) {
  const wrap = el("div", { class: "list-wrap" });

  const sortBar = el("div", { class: "sort-bar" }, [
    el("button", {
      class: "sort-btn" + (state.listSort === "recent" ? " active" : ""),
      onclick: () => { state.listSort = "recent"; render(); },
      text: "최근순",
    }),
    el("button", {
      class: "sort-btn" + (state.listSort === "year" ? " active" : ""),
      onclick: () => { state.listSort = "year"; render(); },
      text: "연도별",
    }),
    el("button", {
      class: "sort-btn" + (state.listSort === "rating" ? " active" : ""),
      onclick: () => { state.listSort = "rating"; render(); },
      text: "별점순",
    }),
  ]);
  wrap.appendChild(sortBar);

  if (state.listSort === "year") {
    const withYear = books.filter((b) => b.finishDate);
    if (withYear.length === 0) {
      wrap.appendChild(
        el("p", { class: "hint", style: "text-align:center;margin-top:24px;", text: "완료일이 등록된 책이 아직 없어요." })
      );
      return wrap;
    }
    const byYear = {};
    withYear.forEach((b) => {
      const year = b.finishDate.slice(0, 4);
      (byYear[year] = byYear[year] || []).push(b);
    });
    const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
    years.forEach((year) => {
      const items = byYear[year].sort((a, b) => b.finishDate.localeCompare(a.finishDate));
      wrap.appendChild(
        el("h2", { class: "year-label" }, [`${year}년 `, el("span", { class: "shelf-count", text: `${items.length}권` })])
      );
      items.forEach((b) => wrap.appendChild(renderListRow(b)));
    });
  } else if (state.listSort === "rating") {
    const sorted = sortByRatingGrouped(books);
    sorted.forEach((b) => wrap.appendChild(renderListRow(b)));
  } else {
    const sorted = [...books].sort((a, b) => {
      const da = a.finishDate || a.startDate || "";
      const db = b.finishDate || b.startDate || "";
      return db.localeCompare(da);
    });
    sorted.forEach((b) => wrap.appendChild(renderListRow(b)));
  }

  return wrap;
}

// 별점순 정렬: 별점 높은순 -> 같은 별점끼리는 최근에 읽은순 -> 단, 제목이 같은(그리고 별점도 같은) 책은 나란히,
// 그 안에서도 최근에 읽은 게 먼저 오도록
function sortByRatingGrouped(books) {
  const byRating = {};
  books.forEach((b) => {
    const r = Number(b.rating) || 0;
    (byRating[r] = byRating[r] || []).push(b);
  });
  const ratingsDesc = Object.keys(byRating).map(Number).sort((a, b) => b - a);
  const result = [];
  ratingsDesc.forEach((r) => {
    const byTitle = {};
    byRating[r].forEach((b) => {
      (byTitle[b.title] = byTitle[b.title] || []).push(b);
    });
    const titleGroups = Object.values(byTitle).map((arr) => {
      const sorted = [...arr].sort((a, b) => {
        const da = a.finishDate || a.startDate || "";
        const db = b.finishDate || b.startDate || "";
        return db.localeCompare(da);
      });
      const anchor = sorted[0].finishDate || sorted[0].startDate || "";
      return { anchor, items: sorted };
    });
    titleGroups.sort((a, b) => b.anchor.localeCompare(a.anchor));
    titleGroups.forEach((g) => result.push(...g.items));
  });
  return result;
}

function renderListRow(b) {
  const row = el("button", { class: "list-row", onclick: () => openDetail(b.id) }, [
    el("span", { class: "dot", style: `background:${genreColor(b.genre)}` }),
    el("span", { class: "list-title", text: b.title }),
    el("span", { class: "list-meta", text: `${b.author ? b.author + " · " : ""}${statusLabel(b.status)}` }),
  ]);
  if (b.status !== "wish" && b.rereadCount) {
    const text = rereadLabel(b.rereadCount) + (b.rereadStatus === "done" ? " · 재독완료" : "");
    row.appendChild(el("span", { class: "list-reread", style: `color:${rereadColor(b.rereadCount)}`, text }));
  }
  if (b.status === "done" && b.rating > 0) {
    row.appendChild(el("span", { class: "list-stars", text: "★".repeat(b.rating) }));
  }
  return row;
}

function openDetail(id) {
  state.detail = state.books.find((b) => b.id === id) || null;
  renderDetail();
}

function closeDetail() {
  state.detail = null;
  renderDetail();
}

function renderDetail() {
  const host = document.getElementById("detail-host");
  host.innerHTML = "";
  const b = state.detail;
  if (!b) return;

  const duration = calcDuration(b.startDate, b.finishDate);

  const infoChildren = [
    el("h2", { class: "sheet-title", text: b.title }),
    el("p", { class: "sheet-meta", text: `${b.author || "저자 미상"} · ${b.genre}${b.pages ? " · " + b.pages + "쪽" : ""}${b.isEbook ? " · 전자책" : ""}` }),
    el("p", { class: "sheet-meta", text: `${statusLabel(b.status)}${b.startDate ? " · 시작 " + b.startDate : ""}${b.finishDate ? " · 완료 " + b.finishDate : ""}` }),
    duration ? el("p", { class: "sheet-meta", text: `독서기간 ${duration}` }) : null,
    b.status !== "wish" && b.rereadCount
      ? el("p", {
          class: "sheet-reread",
          style: `color:${rereadColor(b.rereadCount)}`,
          text: rereadLabel(b.rereadCount) + (b.rereadStatus === "done" ? " · 재독완료" : ""),
        })
      : null,
    b.status === "done" && b.rating > 0
      ? el("p", { class: "sheet-stars", text: "★".repeat(b.rating) + "☆".repeat(6 - b.rating) })
      : null,
    b.memo ? el("p", { class: "sheet-memo", text: b.memo }) : null,
  ];

  const rowChildren = [
    el("div", { style: `width:10px;align-self:stretch;border-radius:4px;background:${genreColor(b.genre)};flex-shrink:0;` }),
    el("div", { style: "flex:1;min-width:0;" }, infoChildren),
  ];
  if (b.cover) {
    rowChildren.push(el("img", { class: "sheet-cover-img", src: b.cover, alt: `${b.title} 표지` }));
  }

  const body = el("div", { style: "display:flex;align-items:flex-start;gap:12px;" }, rowChildren);

  const actions = el("div", { class: "sheet-actions" }, [
    el("button", { class: "btn-ghost", onclick: () => openEditForm(b), text: "수정" }),
    el("button", { class: "btn-danger", onclick: () => askDeleteConfirm(b.id), text: "삭제" }),
    el("button", { class: "btn", onclick: closeDetail, text: "닫기" }),
  ]);

  const sheet = el("div", { class: "sheet", onclick: (e) => e.stopPropagation() }, [
    el("div", { class: "sheet-handle" }),
    body,
    actions,
  ]);
  const overlay = el("div", { class: "overlay", onclick: closeDetail }, [sheet]);
  host.appendChild(overlay);
}

function askDeleteConfirm(id) {
  state.confirmDeleteId = id;
  renderConfirm();
}

function cancelDeleteConfirm() {
  state.confirmDeleteId = null;
  renderConfirm();
}

function renderConfirm() {
  const host = document.getElementById("confirm-host");
  host.innerHTML = "";
  const id = state.confirmDeleteId;
  if (!id) return;
  const book = state.books.find((b) => b.id === id);

  const box = el("div", { class: "confirm-box", onclick: (e) => e.stopPropagation() }, [
    el("p", { class: "confirm-text", text: "정말 삭제하시겠습니까?" }),
    book ? el("p", { class: "confirm-sub", text: book.title }) : null,
    el("div", { class: "sheet-actions" }, [
      el("button", { class: "btn-ghost", onclick: cancelDeleteConfirm, text: "취소" }),
      el("button", { class: "btn-danger-solid", onclick: () => deleteBook(id), text: "삭제" }),
    ]),
  ]);
  const overlay = el("div", { class: "overlay confirm-overlay", onclick: cancelDeleteConfirm }, [box]);
  host.appendChild(overlay);
}

function deleteBook(id) {
  state.books = state.books.filter((b) => b.id !== id);
  state.detail = null;
  state.confirmDeleteId = null;
  saveBooks();
  render();
}

// ---------- 날짜 선택용 미니 달력 ----------

function todayISOString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

let dpState = null; // { value, onSelect, viewY, viewM }

function openDatePicker(currentValue, onSelect) {
  let viewY, viewM;
  if (currentValue) {
    const [y, m] = currentValue.split("-").map(Number);
    viewY = y;
    viewM = m;
  } else {
    const remembered = getLastUsedDate(LAST_CALENDAR_YM_KEY);
    if (remembered) {
      const [y, m] = remembered.split("-").map(Number);
      viewY = y;
      viewM = m;
    } else {
      const t = new Date();
      viewY = t.getFullYear();
      viewM = t.getMonth() + 1;
    }
  }
  dpState = { value: currentValue || "", onSelect, viewY, viewM };
  renderDatePicker();
}

function closeDatePickerModal() {
  dpState = null;
  document.getElementById("datepicker-host").innerHTML = "";
}

function renderDatePicker() {
  const host = document.getElementById("datepicker-host");
  host.innerHTML = "";
  if (!dpState) return;
  const { viewY, viewM, value } = dpState;

  const yearOptions = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear + 1; y >= thisYear - 60; y--) {
    yearOptions.push(el("option", { value: String(y), text: `${y}년`, ...(y === viewY ? { selected: "selected" } : {}) }));
  }
  const yearSelect = el("select", { class: "date-year-select" }, yearOptions);
  yearSelect.addEventListener("change", () => {
    dpState.viewY = Number(yearSelect.value);
    renderDatePicker();
  });

  const header = el("div", { class: "date-panel-header" }, [
    el("button", {
      type: "button",
      class: "date-nav-btn",
      text: "‹",
      onclick: () => {
        dpState.viewM -= 1;
        if (dpState.viewM < 1) { dpState.viewM = 12; dpState.viewY -= 1; }
        renderDatePicker();
      },
    }),
    el("div", { class: "date-panel-title" }, [yearSelect, el("span", { text: ` ${viewM}월` })]),
    el("button", {
      type: "button",
      class: "date-nav-btn",
      text: "›",
      onclick: () => {
        dpState.viewM += 1;
        if (dpState.viewM > 12) { dpState.viewM = 1; dpState.viewY += 1; }
        renderDatePicker();
      },
    }),
  ]);

  const weekRow = el("div", { class: "date-weekday-row" });
  ["일", "월", "화", "수", "목", "금", "토"].forEach((w) => weekRow.appendChild(el("span", { text: w })));

  const grid = el("div", { class: "date-grid" });
  const totalDays = new Date(viewY, viewM, 0).getDate();
  const startOffset = new Date(viewY, viewM - 1, 1).getDay();
  const todayStr = todayISOString();
  for (let i = 0; i < startOffset; i++) grid.appendChild(el("span", { class: "date-cell date-cell-empty" }));
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${viewY}-${pad2(viewM)}-${pad2(d)}`;
    grid.appendChild(
      el("button", {
        type: "button",
        class: "date-cell" + (value === dateStr ? " date-cell-selected" : "") + (dateStr === todayStr ? " date-cell-today" : ""),
        text: String(d),
        onclick: () => {
          setLastUsedDate(LAST_CALENDAR_YM_KEY, `${viewY}-${pad2(viewM)}`);
          const cb = dpState.onSelect;
          closeDatePickerModal();
          cb(dateStr);
        },
      })
    );
  }

  const footer = el("div", { class: "date-panel-footer" }, [
    el("button", {
      type: "button",
      class: "date-footer-btn",
      text: "오늘",
      onclick: () => {
        const t = todayISOString();
        const [ty, tm] = t.split("-").map(Number);
        setLastUsedDate(LAST_CALENDAR_YM_KEY, `${ty}-${pad2(tm)}`);
        const cb = dpState.onSelect;
        closeDatePickerModal();
        cb(t);
      },
    }),
    el("button", {
      type: "button",
      class: "date-footer-btn date-footer-btn-ghost",
      text: "지우기",
      onclick: () => {
        const cb = dpState.onSelect;
        closeDatePickerModal();
        cb("");
      },
    }),
    el("button", { type: "button", class: "date-footer-btn date-footer-btn-ghost", text: "닫기", onclick: closeDatePickerModal }),
  ]);

  const box = el("div", { class: "date-modal", onclick: (e) => e.stopPropagation() }, [header, weekRow, grid, footer]);
  const overlay = el("div", { class: "overlay date-overlay", onclick: closeDatePickerModal }, [box]);
  host.appendChild(overlay);
}

const LAST_CALENDAR_YM_KEY = "last-calendar-ym";

function getLastUsedDate(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (e) {
    return "";
  }
}

function setLastUsedDate(key, value) {
  if (!value) return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // 저장 실패해도 무시 (편의 기능이라 치명적이지 않음)
  }
}

function emptyForm() {
  return {
    id: null,
    title: "",
    author: "",
    genre: GENRES[0].name,
    pages: "",
    status: "done",
    startDate: "",
    finishDate: "",
    rereadCount: 1,
    rereadStatus: "none",
    isEbook: false,
    rating: 0,
    memo: "",
    cover: null,
  };
}

function openAddForm() {
  state.editing = emptyForm();
  renderForm();
}

function openEditForm(book) {
  state.detail = null;
  renderDetail();
  state.editing = {
    ...book,
    pages: String(book.pages || ""),
    rereadCount: book.rereadCount || 1,
    rereadStatus: book.rereadStatus || "none",
    isEbook: book.isEbook || false,
    cover: book.cover || null,
  };
  renderForm();
}

function closeForm() {
  state.editing = null;
  renderForm();
}

function renderForm() {
  const host = document.getElementById("form-host");
  host.innerHTML = "";
  const f = state.editing;
  if (!f) return;

  const titleInput = el("input", { value: f.title, placeholder: "책 제목" });
  const ebookInput = el("input", { type: "checkbox" });
  if (f.isEbook) ebookInput.checked = true;
  const ebookField = el("label", { class: "field field-checkbox" }, [
    el("span", { text: "전자책" }),
    ebookInput,
  ]);
  const authorInput = el("input", { value: f.author, placeholder: "저자 이름" });
  const genreSelect = el(
    "select",
    {},
    GENRES.map((g) => el("option", { value: g.name, text: g.name, ...(g.name === f.genre ? { selected: "selected" } : {}) }))
  );
  const pagesInput = el("input", { type: "number", min: "0", value: f.pages, placeholder: "0" });

  const statusSelect = el(
    "select",
    {},
    STATUS_FORM_ORDER.map((key) =>
      el("option", { value: key, text: statusLabel(key), ...(key === f.status ? { selected: "selected" } : {}) })
    )
  );

  const rereadSelect = el(
    "select",
    { disabled: f.status === "wish" },
    [1, 2, 3, 4, 5, REREAD_TRAINING].map((n) =>
      el("option", { value: String(n), text: rereadLabel(n), ...(String(n) === String(f.rereadCount || 1) ? { selected: "selected" } : {}) })
    )
  );

  const rereadStatusSelect = el(
    "select",
    { disabled: f.status === "wish" },
    REREAD_STATUSES.map((r) =>
      el("option", { value: r.key, text: r.label, ...(r.key === (f.rereadStatus || "none") ? { selected: "selected" } : {}) })
    )
  );

  let startValue = f.startDate || "";
  let finishValue = f.finishDate || "";

  const startTrigger = el("button", {
    type: "button",
    class: "date-trigger" + (startValue ? "" : " date-trigger-empty"),
    text: startValue || "날짜 선택",
    onclick: () => {
      openDatePicker(startValue, (v) => {
        startValue = v;
        startTrigger.textContent = v || "날짜 선택";
        startTrigger.classList.toggle("date-trigger-empty", !v);
        updateDuration();
      });
    },
  });

  const finishTrigger = el("button", {
    type: "button",
    class: "date-trigger" + (finishValue ? "" : " date-trigger-empty"),
    text: finishValue || "날짜 선택",
    onclick: () => {
      openDatePicker(finishValue, (v) => {
        finishValue = v;
        finishTrigger.textContent = v || "날짜 선택";
        finishTrigger.classList.toggle("date-trigger-empty", !v);
        updateDuration();
      });
    },
  });

  const durationText = el("p", { class: "duration-text", text: calcDuration(startValue, finishValue) || "시작일과 완료일을 입력하면 자동으로 계산돼요." });

  function updateDuration() {
    durationText.textContent = calcDuration(startValue, finishValue) || "시작일과 완료일을 입력하면 자동으로 계산돼요.";
  }

  statusSelect.addEventListener("change", () => {
    if (statusSelect.value === "wish") {
      rereadSelect.setAttribute("disabled", "disabled");
      rereadStatusSelect.setAttribute("disabled", "disabled");
    } else {
      rereadSelect.removeAttribute("disabled");
      rereadStatusSelect.removeAttribute("disabled");
    }
  });

  const memoInput = el("textarea", { placeholder: "기억하고 싶은 문장이나 생각을 적어보세요", text: f.memo });

  let rating = f.rating || 0;
  const starsWrap = el("div", { class: "stars-input" });
  function renderStars() {
    starsWrap.innerHTML = "";
    for (let n = 1; n <= 6; n++) {
      const s = el("button", {
        type: "button",
        class: "star-btn" + (n <= rating ? " filled" : ""),
        text: "★",
        onclick: () => {
          rating = rating === n ? 0 : n;
          renderStars();
        },
      });
      starsWrap.appendChild(s);
    }
  }
  renderStars();

  // 책 표지 이미지 첨부
  let coverData = f.cover || null;
  const coverPreviewWrap = el("div", { class: "cover-preview-wrap" });
  function renderCoverPreview() {
    coverPreviewWrap.innerHTML = "";
    if (coverData) {
      coverPreviewWrap.appendChild(el("img", { class: "cover-preview-img", src: coverData, alt: "책 표지 미리보기" }));
      coverPreviewWrap.appendChild(
        el("button", {
          type: "button",
          class: "btn-ghost cover-remove-btn",
          text: "이미지 삭제",
          onclick: () => { coverData = null; renderCoverPreview(); },
        })
      );
    } else {
      coverPreviewWrap.appendChild(el("p", { class: "hint cover-empty-hint", text: "아직 등록된 표지 이미지가 없어요." }));
    }
  }
  renderCoverPreview();

  const coverInput = el("input", {
    type: "file",
    accept: "image/*",
    onchange: async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        coverData = await readAndCompressImage(file);
        renderCoverPreview();
      } catch (err) {
        showError("이미지를 불러오지 못했어요.");
      }
    },
  });

  const form = el("form", { class: "form" }, [
    el("div", { class: "row3" }, [
      el("label", { class: "field" }, ["제목", titleInput]),
      ebookField,
    ]),
    el("label", { class: "field" }, ["저자", authorInput]),
    el("div", { class: "row2" }, [
      el("label", { class: "field" }, ["장르", genreSelect]),
      el("label", { class: "field" }, ["페이지 수", pagesInput]),
    ]),
    el("div", { class: "row3" }, [
      el("label", { class: "field" }, ["상태", statusSelect]),
      el("label", { class: "field" }, ["회독", rereadSelect]),
      el("label", { class: "field" }, ["재독", rereadStatusSelect]),
    ]),
    el("div", { class: "row2" }, [
      el("label", { class: "field" }, ["시작일", startTrigger]),
      el("label", { class: "field" }, ["완료일", finishTrigger]),
    ]),
    el("label", { class: "field" }, ["독서기간", durationText]),
    el("label", { class: "field" }, ["평점", starsWrap]),
    el("label", { class: "field" }, ["메모 / 감상", memoInput]),
    el("label", { class: "field" }, ["책 표지 이미지", coverInput, coverPreviewWrap]),
    el("div", { class: "sheet-actions" }, [
      el("button", { type: "button", class: "btn-ghost", onclick: closeForm, text: "취소" }),
      el("button", { type: "submit", class: "btn", text: "저장" }),
    ]),
  ]);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      showError("제목을 입력해 주세요.");
      return;
    }
    const payload = {
      id: f.id || uid(),
      title,
      author: authorInput.value.trim(),
      genre: genreSelect.value,
      pages: parseInt(pagesInput.value, 10) || 0,
      status: statusSelect.value,
      startDate: startValue,
      finishDate: finishValue,
      rereadCount: statusSelect.value === "wish" ? 0 : (rereadSelect.value === REREAD_TRAINING ? REREAD_TRAINING : (Number(rereadSelect.value) || 1)),
      rereadStatus: statusSelect.value === "wish" ? "none" : rereadStatusSelect.value,
      isEbook: ebookInput.checked,
      rating: Number(rating) || 0,
      memo: memoInput.value,
      cover: coverData || null,
    };
    const idx = state.books.findIndex((b) => b.id === payload.id);
    if (idx >= 0) state.books[idx] = payload;
    else state.books.unshift(payload);
    saveBooks();
    closeForm();
    render();
  });

  const modal = el("div", { class: "modal", onclick: (e) => e.stopPropagation() }, [
    el("h2", { class: "sheet-title", text: f.id ? "책 정보 수정" : "책 추가" }),
    form,
  ]);
  const overlay = el("div", { class: "overlay", onclick: closeForm }, [modal]);
  host.appendChild(overlay);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayCompact() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const STATUS_LABEL_TO_KEY = STATUSES.reduce((acc, s) => {
  acc[s.label] = s.key;
  return acc;
}, {});

const REREAD_STATUS_LABEL_TO_KEY = REREAD_STATUSES.reduce((acc, r) => {
  acc[r.label] = r.key;
  return acc;
}, {});

function excelCellToDateString(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  return "";
}

// ---------- 내보내기 ----------

function exportJSON() {
  const dataStr = JSON.stringify(state.books, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  downloadBlob(blob, `내서재_백업_${todayCompact()}.json`);
  showSuccess("JSON 백업 파일을 저장했어요. (표지 이미지 포함)");
}

function exportExcel() {
  if (typeof XLSX === "undefined") {
    showError("엑셀 기능을 아직 불러오지 못했어요. 인터넷 연결 후 다시 시도해 주세요.");
    return;
  }
  const rows = state.books.map((b) => ({
    "제목": b.title,
    "전자책": b.isEbook ? "예" : "아니오",
    "저자": b.author || "",
    "장르": b.genre,
    "페이지수": b.pages || 0,
    "상태": statusLabel(b.status),
    "회독": b.status === "wish" ? "" : rereadLabel(b.rereadCount || 1),
    "재독상태": b.status === "wish" ? "" : rereadStatusLabel(b.rereadStatus || "none"),
    "시작일": b.startDate || "",
    "완료일": b.finishDate || "",
    "독서기간": calcDuration(b.startDate, b.finishDate),
    "평점": b.rating || 0,
    "메모": b.memo || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "내서재");
  XLSX.writeFile(wb, `내서재_백업_${todayCompact()}.xlsx`);
  showSuccess("엑셀 파일을 저장했어요. (표지 이미지는 포함되지 않아요)");
}

// ---------- 가져오기 ----------

function normalizeImportedBook(raw) {
  if (!raw || !String(raw.title || "").trim()) return null;
  const rawStatus = raw.status === "rereading" ? "reading" : raw.status;
  return {
    id: raw.id || uid(),
    title: String(raw.title).trim(),
    author: String(raw.author || "").trim(),
    genre: String(raw.genre || GENRES[0].name).trim(),
    pages: parseInt(raw.pages, 10) || 0,
    status: STATUSES.some((s) => s.key === rawStatus) ? rawStatus : "wish",
    startDate: raw.startDate || "",
    finishDate: raw.finishDate || "",
    rereadCount: rawStatus === "wish" ? 0 : (raw.rereadCount === REREAD_TRAINING ? REREAD_TRAINING : (Number(raw.rereadCount) || 1)),
    rereadStatus: raw.rereadStatus || (raw.rereadDone ? "done" : "none"),
    isEbook: !!raw.isEbook,
    rating: Math.min(6, Math.max(0, Number(raw.rating) || 0)),
    memo: String(raw.memo || "").trim(),
    cover: raw.cover || null,
  };
}

function rowToBook(row) {
  const title = String(row["제목"] || "").trim();
  if (!title) return null;
  const statusLabelVal = String(row["상태"] || "").trim();
  const statusKey = STATUS_LABEL_TO_KEY[statusLabelVal] || (statusLabelVal === "재독중" ? "reading" : "wish");
  const rereadCellRaw = String(row["회독"] || "").trim();
  const rereadRaw = rereadCellRaw.replace(/[^0-9]/g, "");
  return {
    id: uid(),
    title,
    author: String(row["저자"] || "").trim(),
    genre: String(row["장르"] || GENRES[0].name).trim(),
    pages: parseInt(row["페이지수"], 10) || 0,
    status: statusKey,
    startDate: excelCellToDateString(row["시작일"]),
    finishDate: excelCellToDateString(row["완료일"]),
    rereadCount: statusKey === "wish" ? 0 : (rereadCellRaw.includes("독서훈련") ? REREAD_TRAINING : (parseInt(rereadRaw, 10) || 1)),
    rereadStatus: statusKey === "wish" ? "none" : (REREAD_STATUS_LABEL_TO_KEY[String(row["재독상태"] || "").trim()] || "none"),
    isEbook: String(row["전자책"] || "").trim() === "예",
    rating: Math.min(6, Math.max(0, parseInt(row["평점"], 10) || 0)),
    memo: String(row["메모"] || "").trim(),
    cover: null,
  };
}

function mergeImportedBooks(list, sourceLabel) {
  let added = 0;
  let updated = 0;
  list.forEach((nb) => {
    if (!nb) return;
    const idx = state.books.findIndex((b) => b.id === nb.id);
    if (idx >= 0) {
      state.books[idx] = { ...state.books[idx], ...nb };
      updated++;
    } else {
      state.books.unshift(nb);
      added++;
    }
  });
  if (added === 0 && updated === 0) {
    showError("가져올 수 있는 책 정보를 찾지 못했어요.");
    return;
  }
  saveBooks();
  closeBackupModal();
  render();
  showSuccess(`${sourceLabel} 가져오기 완료 · 추가 ${added}건 · 갱신 ${updated}건`);
}

function handleImportJSONFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error("배열 형식이 아님");
      const books = parsed.map(normalizeImportedBook).filter(Boolean);
      mergeImportedBooks(books, "JSON");
    } catch (err) {
      showError("JSON 파일을 읽지 못했어요. 이 앱에서 내보낸 파일이 맞는지 확인해 주세요.");
    }
  };
  reader.onerror = () => showError("파일을 읽는 데 실패했어요.");
  reader.readAsText(file, "utf-8");
}

function handleImportExcelFile(file) {
  if (typeof XLSX === "undefined") {
    showError("엑셀 기능을 아직 불러오지 못했어요. 인터넷 연결 후 다시 시도해 주세요.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const books = rows.map(rowToBook).filter(Boolean);
      mergeImportedBooks(books, "엑셀");
    } catch (err) {
      showError("엑셀 파일을 읽지 못했어요. 내보내기한 형식과 같은지 확인해 주세요.");
    }
  };
  reader.onerror = () => showError("파일을 읽는 데 실패했어요.");
  reader.readAsArrayBuffer(file);
}

// ---------- 백업/복원 모달 ----------

function closeBackupModal() {
  document.getElementById("backup-host").innerHTML = "";
}

function openBackupModal() {
  const host = document.getElementById("backup-host");
  host.innerHTML = "";

  const jsonFileInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    class: "hidden",
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImportJSONFile(file);
    },
  });
  const excelFileInput = el("input", {
    type: "file",
    accept: ".xlsx,.xls",
    class: "hidden",
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImportExcelFile(file);
    },
  });

  const box = el("div", { class: "modal", onclick: (e) => e.stopPropagation() }, [
    el("h2", { class: "sheet-title", text: "백업 및 복원" }),
    el("p", { class: "sheet-meta", text: `현재 ${state.books.length}권 저장됨` }),

    el("h3", { class: "backup-section-title", text: "내보내기" }),
    el("div", { class: "backup-actions" }, [
      el("button", { type: "button", class: "btn", onclick: exportJSON, text: "JSON 파일로 저장" }),
      el("button", { type: "button", class: "btn-ghost", onclick: exportExcel, text: "엑셀 파일로 저장" }),
    ]),
    el("p", { class: "backup-hint", text: "JSON은 표지 이미지까지 완전하게 백업돼요. 엑셀은 텍스트 정보만 저장되고 이미지는 포함되지 않아요." }),

    el("h3", { class: "backup-section-title", text: "가져오기" }),
    el("div", { class: "backup-actions" }, [
      el("button", { type: "button", class: "btn", onclick: () => jsonFileInput.click(), text: "JSON 파일 선택" }),
      el("button", { type: "button", class: "btn-ghost", onclick: () => excelFileInput.click(), text: "엑셀 파일 선택" }),
    ]),
    el("p", { class: "backup-hint", text: "가져온 책은 기존 목록에 추가/갱신돼요. 엑셀로 가져오면 표지 이미지는 비어있는 상태로 추가돼요." }),
    jsonFileInput,
    excelFileInput,

    el("div", { class: "sheet-actions" }, [
      el("button", { type: "button", class: "btn-ghost", onclick: closeBackupModal, text: "닫기" }),
    ]),
  ]);
  const overlay = el("div", { class: "overlay", onclick: closeBackupModal }, [box]);
  host.appendChild(overlay);
}

function init() {
  loadBooks();
  document.getElementById("add-btn").addEventListener("click", openAddForm);
  document.getElementById("backup-btn").addEventListener("click", openBackupModal);
  document.getElementById("tab-shelf").addEventListener("click", () => {
    state.view = "shelf";
    render();
  });
  document.getElementById("tab-list").addEventListener("click", () => {
    state.view = "list";
    render();
  });

  const searchInput = document.getElementById("search-input");
  const searchClearBtn = document.getElementById("search-clear-btn");
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    searchClearBtn.classList.toggle("hidden", !state.searchQuery);
    render();
  });
  searchClearBtn.addEventListener("click", () => {
    state.searchQuery = "";
    searchInput.value = "";
    searchClearBtn.classList.add("hidden");
    render();
    searchInput.focus();
  });

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
