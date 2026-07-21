const fileInput = document.getElementById('file');
const preview = document.getElementById('preview');
const thumbStrip = document.getElementById('thumbStrip');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const numlist = document.getElementById('numlist');
const totalEl = document.getElementById('total');
const addBtn = document.getElementById('addBtn');
let numbers = [];
let images = []; // { id, dataUrl, included }
let nextImageId = 1;

function setImageIncluded(imgId, included) {
  const img = images.find(im => im.id === imgId);
  if (img) img.included = included;
  numbers.forEach(item => {
    if (item.imgId === imgId) item.checked = included;
  });
  renderThumbnails();
  renderNumbers();
}

function removeImage(imgId) {
  images = images.filter(im => im.id !== imgId);
  numbers = numbers.filter(item => item.imgId !== imgId);
  imageCount = images.length;
  renderThumbnails();
  if (numbers.length === 0) {
    resultsEl.style.display = 'none';
  } else {
    renderNumbers();
  }
  if (images.length === 0) preview.style.display = 'none';
}

function renderThumbnails() {
  thumbStrip.innerHTML = '';
  images.forEach(img => {
    const wrap = document.createElement('div');
    wrap.className = 'thumbWrap' + (img.included ? '' : ' excluded');

    const thumb = document.createElement('img');
    thumb.src = img.dataUrl;
    thumb.alt = '截图缩略图';
    thumb.addEventListener('click', () => {
      lightboxImg.src = img.dataUrl;
      lightbox.style.display = 'flex';
    });

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'thumbCheck';
    cb.checked = img.included;
    cb.title = '取消勾选可排除这张图的数字';
    cb.addEventListener('change', () => setImageIncluded(img.id, cb.checked));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'thumbDel';
    del.textContent = '×';
    del.title = '删除这张图及其数字';
    del.addEventListener('click', () => removeImage(img.id));

    wrap.appendChild(thumb);
    wrap.appendChild(cb);
    wrap.appendChild(del);
    thumbStrip.appendChild(wrap);
  });
  preview.style.display = images.length ? 'block' : 'none';
  thumbStrip.scrollLeft = thumbStrip.scrollWidth;
}

function addThumbnail(dataUrl) {
  const id = nextImageId++;
  images.push({ id, dataUrl, included: true });
  renderThumbnails();
  return id;
}

lightbox.addEventListener('click', () => {
  lightbox.style.display = 'none';
});

function setStatus(t) {
  statusEl.style.display = t ? 'block' : 'none';
  statusEl.textContent = t;
}

function extractNumbers(text, imgId) {
  const matches = text.match(/-?\d[\d,]*\.?\d*/g) || [];
  return matches
    .map(s => parseFloat(s.replace(/,/g, '')))
    .filter(n => !isNaN(n))
    .map(value => ({ value, checked: true, imgId }));
}

function renderNumbers() {
  const imgCountLabel = document.getElementById('imgCountLabel');
  imgCountLabel.textContent = imageCount > 1 ? `（已处理 ${imageCount} 张图片）` : '';
  numlist.innerHTML = '';
  numbers.forEach((item, i) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;background:#f0f0f0;border-radius:6px;padding:4px 6px;font-size:12px;';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    const applyRowStyle = () => {
      row.style.opacity = cb.checked ? '1' : '0.45';
      input.style.textDecoration = cb.checked ? 'none' : 'line-through';
    };
    cb.addEventListener('change', () => {
      numbers[i].checked = cb.checked;
      applyRowStyle();
      updateTotal();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = item.value;
    input.style.cssText = 'width:64px;border:1px solid #ddd;border-radius:4px;padding:2px 4px;font-size:12px;';
    input.addEventListener('input', () => {
      const v = parseFloat(input.value.replace(/,/g, ''));
      numbers[i].value = isNaN(v) ? 0 : v;
      updateTotal();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '×';
    del.title = '删除';
    del.style.cssText = 'border:none;background:none;color:#999;cursor:pointer;font-size:14px;line-height:1;padding:0 2px;';
    del.addEventListener('click', () => {
      numbers.splice(i, 1);
      renderNumbers();
    });

    row.appendChild(cb);
    row.appendChild(input);
    row.appendChild(del);
    applyRowStyle();
    numlist.appendChild(row);
  });
  updateTotal();
}

function updateTotal() {
  let sum = 0;
  numbers.forEach(item => {
    if (item.checked) sum += item.value;
  });
  totalEl.textContent = (Math.round(sum * 100) / 100).toLocaleString();
}

addBtn.addEventListener('click', () => {
  numbers.push({ value: 0, checked: true });
  renderNumbers();
});

const selectAllBtn = document.getElementById('selectAllBtn');
selectAllBtn.addEventListener('click', () => {
  numbers.forEach(item => { item.checked = true; });
  images.forEach(img => { img.included = true; });
  renderThumbnails();
  renderNumbers();
});

const clearBtn = document.getElementById('clearBtn');
clearBtn.addEventListener('click', () => {
  numbers = [];
  images = [];
  imageCount = 0;
  resultsEl.style.display = 'none';
  preview.style.display = 'none';
  thumbStrip.innerHTML = '';
  setStatus('');
});

const copyBtn = document.getElementById('copyBtn');
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(totalEl.textContent.replace(/,/g, ''));
    const original = copyBtn.textContent;
    copyBtn.textContent = '已复制';
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
  } catch (e) {
    setStatus('复制失败，请手动选中数字复制');
  }
});

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const langPath = chrome.runtime.getURL('').replace(/\/$/, '');
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: 'worker.min.js',
        corePath: 'tesseract-core-simd-lstm.wasm.js',
        langPath: langPath,
        workerBlobURL: false,
        logger: (m) => {
          if (m.status) {
            const pct = m.progress ? ` ${Math.round(m.progress * 100)}%` : '';
            setStatus(m.status + pct);
          }
        }
      });
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,-'
      });
      return worker;
    })();
  }
  return workerPromise;
}

let imageCount = 0;
let processQueue = Promise.resolve();

async function doProcessFiles(fileList) {
  const files = Array.from(fileList);
  if (files.length === 0) return;
  if (numbers.length === 0) resultsEl.style.display = 'none';
  try {
    for (let i = 0; i < files.length; i++) {
      const dataUrl = await fileToDataUrl(files[i]);
      const imgId = addThumbnail(dataUrl);
      const label = files.length > 1
        ? `正在识别第 ${i + 1}/${files.length} 张…`
        : (workerPromise ? '正在识别…' : '首次识别需要加载本地引擎，稍等几秒，之后会快很多…');
      setStatus(label);
      const worker = await getWorker();
      const { data } = await worker.recognize(dataUrl);
      numbers = numbers.concat(extractNumbers(data.text, imgId));
      imageCount = images.length;
      resultsEl.style.display = 'block';
      renderNumbers();
    }
    setStatus('');
    if (numbers.length === 0) {
      setStatus('没有识别到数字，试试更清晰的截图');
    }
  } catch (e) {
    setStatus('识别失败：' + (e?.message || e));
    console.error(e);
  }
}

function processFiles(fileList) {
  processQueue = processQueue.then(() => doProcessFiles(fileList));
  return processQueue;
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) processFiles(e.target.files);
});

document.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items || [];
  const files = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      files.push(item.getAsFile());
    }
  }
  if (files.length) processFiles(files);
});
