const STORAGE_KEY = "majulyah-catalogue";
const SOURCE_FILE = "../product.json";

const state = {
  data: { categories: [], products: [] },
  selectedIndex: null,
  isNew: false,
};
const $ = (selector) => document.querySelector(selector);
const elements = {
  list: $("#productList"),
  count: $("#productCount"),
  search: $("#searchInput"),
  form: $("#productForm"),
  empty: $("#emptyEditor"),
  title: $("#editorTitle"),
  name: $("#nameField"),
  price: $("#priceField"),
  category: $("#categoryField"),
  image: $("#imageField"),
  description: $("#descriptionField"),
  visible: $("#visibleField"),
  mode: $("#selectionModeField"),
  variantsLabel: $("#variantsLabelField"),
  variants: $("#variantsField"),
  colors: $("#colorsField"),
  preview: $("#imagePreview"),
  status: $("#saveStatus"),
  toast: $("#toast"),
};

function normalizeData(data) {
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    products: Array.isArray(data.products) ? data.products : [],
  };
}
function categoryName(category) {
  return typeof category === "string" ? category : category.name;
}
function listToText(value) {
  return Array.isArray(value)
    ? value
        .map((item) =>
          typeof item === "string" ? item : item.option || item.color,
        )
        .filter(Boolean)
        .join(", ")
    : "";
}
function textToList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function productImage(product) {
  const source = product.image || "";
  if (/^images\//i.test(source)) return `../${source}`;
  return source;
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}
function saveLocalData(message = "Sauvegardé dans ce navigateur") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  elements.status.textContent = message;
  showToast(message);
}

async function loadData() {
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
    try {
      state.data = normalizeData(JSON.parse(localData));
      return;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const response = await fetch(SOURCE_FILE, { cache: "no-cache" });
  if (!response.ok) throw new Error("Impossible de charger product.json");
  state.data = normalizeData(await response.json());
}

function renderCategoryOptions(selected = "") {
  elements.category.innerHTML = state.data.categories
    .map((category) => {
      const name = categoryName(category);
      return `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`;
    })
    .join("");
  if (
    selected &&
    !state.data.categories.some(
      (category) => categoryName(category) === selected,
    )
  ) {
    elements.category.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeAttribute(selected)}">${escapeHtml(selected)}</option>`,
    );
  }
  elements.category.value =
    selected || categoryName(state.data.categories[0]) || "";
}
function renderList() {
  const query = elements.search.value.trim().toLowerCase();
  const items = state.data.products
    .map((product, index) => ({ product, index }))
    .filter(
      ({ product }) =>
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query),
    );
  elements.count.textContent = `${state.data.products.length} article${state.data.products.length > 1 ? "s" : ""}`;
  elements.list.innerHTML = items.length
    ? items
        .map(
          ({ product, index }) =>
            `<button class="product-card ${state.selectedIndex === index && !state.isNew ? "active" : ""}" data-index="${index}" type="button"><img class="product-thumb" src="${escapeAttribute(productImage(product))}" alt="" onerror="this.style.opacity='.25'" /><span><strong>${escapeHtml(product.name || "Sans nom")}</strong><small class="${product.visible === false ? "hidden-label" : ""}">${escapeHtml(product.category || "Sans catégorie")} · ${product.visible === false ? "Masqué" : "Visible"}</small></span></button>`,
        )
        .join("")
    : `<p class="field-help" style="padding: 12px">Aucun produit trouvé.</p>`;
  elements.list
    .querySelectorAll("[data-index]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        selectProduct(Number(button.dataset.index)),
      ),
    );
}
function renderPreview(source) {
  elements.preview.innerHTML = source
    ? `<img src="${escapeAttribute(source)}" alt="Aperçu du produit" onerror="this.parentElement.innerHTML='<span>Image introuvable</span>'" />`
    : "<span>Aperçu de l'image</span>";
}
function fillForm(product) {
  elements.title.textContent = state.isNew
    ? "Nouveau produit"
    : product.name || "Produit sans nom";
  elements.name.value = product.name || "";
  elements.price.value = product.price ?? "";
  renderCategoryOptions(product.category || "");
  elements.image.value = product.image || "";
  elements.description.value = product.description || "";
  elements.visible.checked = product.visible !== false;
  elements.mode.value = product.selection_mode || "single";
  elements.variantsLabel.value = product.variants_label || "";
  elements.variants.value = listToText(product.variants);
  elements.colors.value = listToText(product.colors);
  renderPreview(productImage(product));
}
function selectProduct(index) {
  state.selectedIndex = index;
  state.isNew = false;
  elements.empty.hidden = true;
  elements.form.hidden = false;
  fillForm(state.data.products[index]);
  renderList();
}
function newProduct() {
  state.selectedIndex = null;
  state.isNew = true;
  elements.empty.hidden = true;
  elements.form.hidden = false;
  fillForm({
    name: "",
    price: 0,
    category: categoryName(state.data.categories[0]) || "",
    visible: true,
    selection_mode: "single",
  });
  renderList();
  elements.name.focus();
}
function readForm() {
  return {
    name: elements.name.value.trim(),
    price: Number(elements.price.value) || 0,
    category: elements.category.value,
    image: elements.image.value.trim(),
    description: elements.description.value.trim(),
    visible: elements.visible.checked,
    selection_mode: elements.mode.value,
    variants_label: elements.variantsLabel.value.trim(),
    variants: textToList(elements.variants.value),
    colors: textToList(elements.colors.value),
  };
}
function saveProduct(event) {
  event.preventDefault();
  const product = readForm();
  if (!product.name) return;
  if (state.isNew) {
    state.data.products.unshift(product);
    state.selectedIndex = 0;
    state.isNew = false;
  } else {
    state.data.products[state.selectedIndex] = product;
  }
  saveLocalData();
  elements.empty.hidden = true;
  elements.form.hidden = false;
  fillForm(product);
  renderList();
}
function deleteProduct() {
  if (state.isNew || state.selectedIndex === null) return;
  const product = state.data.products[state.selectedIndex];
  if (!window.confirm(`Supprimer « ${product.name} » ?`)) return;
  state.data.products.splice(state.selectedIndex, 1);
  saveLocalData("Produit supprimé");
  state.selectedIndex = null;
  elements.form.hidden = true;
  elements.empty.hidden = false;
  renderList();
}
function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "product.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("product.json téléchargé");
}
function resetData() {
  if (
    !window.confirm(
      "Effacer les changements locaux et revenir au fichier product.json ?",
    )
  )
    return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttribute(value) {
  return escapeHtml(value);
}

elements.form.addEventListener("submit", saveProduct);
elements.search.addEventListener("input", renderList);
$("#newProductButton").addEventListener("click", newProduct);
$("#addProductButton").addEventListener("click", newProduct);
$("#emptyNewButton").addEventListener("click", newProduct);
$("#deleteButton").addEventListener("click", deleteProduct);
$("#exportButton").addEventListener("click", exportData);
$("#resetButton").addEventListener("click", resetData);
$("#cancelButton").addEventListener("click", () =>
  state.selectedIndex === null
    ? ((elements.form.hidden = true), (elements.empty.hidden = false))
    : selectProduct(state.selectedIndex),
);
elements.image.addEventListener("input", () =>
  renderPreview(elements.image.value.trim()),
);
$("#imageFile").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    elements.image.value = reader.result;
    renderPreview(reader.result);
  };
  reader.readAsDataURL(file);
});

loadData()
  .then(() => {
    renderList();
  })
  .catch((error) => {
    elements.status.textContent = error.message;
    showToast(error.message);
  });
