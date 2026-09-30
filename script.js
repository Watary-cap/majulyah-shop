/* ==========================================================================
MAJU'LYAH - CATALOGUE PRODUITS
Les produits ne sont plus écrits ici : ils viennent de product.json,
que l'on modifie directement dans le fichier de données.
========================================================================== */

const CATALOGUE_URL = "product.json";

let products = [];
let categories = [];

/* Échappe le texte des données avant de l'injecter dans le HTML */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(value) {
  return `${Number(value || 0)
    .toFixed(2)
    .replace(".", ",")} €`;
}

/* Produit à choix multiples + couleur (ex : stickers par matière) */
function isMultiChoice(product) {
  return product && product.selection_mode === "multi_color";
}

/* Libellé du choix : personnalisable dans les données, sinon valeur par défaut */
function getVariantLabel(product) {
  if (product.variants_label && product.variants_label.trim()) {
    return product.variants_label.trim();
  }
  return isMultiChoice(product) ? "Matières" : "Option";
}

/* Mise en forme légère des textes : **gras** et *italique* */
function formatInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

/* Remplace les paragraphes d'un bloc par ceux venant des données */
function setParagraphs(container, selector, texts, styleFor) {
  if (!container || !Array.isArray(texts) || texts.length === 0) return;

  const existing = container.querySelectorAll(selector);
  const anchor = existing[0];
  if (!anchor) return;

  const fragment = document.createDocumentFragment();
  texts.forEach((text, index) => {
    const p = document.createElement("p");
    p.className = anchor.className;
    const style = styleFor ? styleFor(index, texts.length) : "";
    if (style) p.setAttribute("style", style);
    p.innerHTML = formatInline(text);
    fragment.appendChild(p);
  });

  anchor.before(fragment);
  existing.forEach((node) => node.remove());
}

/* Textes du site (accueil, à propos, contact) : site.json.
   Si le fichier est absent ou illisible, le contenu écrit dans index.html reste affiché. */
async function loadSiteContent() {
  try {
    const response = await fetch("site.json", { cache: "no-cache" });
    if (!response.ok) return;
    const site = await response.json();

    /* Bannière */
    const hero = document.querySelector(".hero-section");
    if (hero && site.hero_image) {
      hero.style.backgroundImage = `url("${encodeURI(site.hero_image)}")`;
    }

    /* Présentation */
    const intro = document.querySelector(".intro-section .container");
    if (intro && site.intro) {
      const title = intro.querySelector(".section-title");
      if (title && site.intro.title) title.textContent = site.intro.title;

      setParagraphs(intro, "p.intro-text", site.intro.paragraphs, (i, n) =>
        i < n - 1 ? "margin-bottom: 20px" : "",
      );
    }

    /* À propos */
    const about = document.querySelector(".about-text-content");
    if (about && site.about) {
      const subtitle = about.querySelector(".sub-subtitle");
      if (subtitle && site.about.subtitle)
        subtitle.textContent = site.about.subtitle;

      const title = about.querySelector(".section-title");
      if (title && site.about.title) title.textContent = site.about.title;

      setParagraphs(about, "p", site.about.paragraphs);
    }

    const aboutImg = document.querySelector(".about-img");
    if (aboutImg && site.about && site.about.image) {
      aboutImg.src = site.about.image;
    }

    /* Contact */
    const contact = document.querySelector(".contact-section");
    if (contact && site.contact) {
      const title = contact.querySelector(".section-title");
      if (title && site.contact.title) title.textContent = site.contact.title;

      const text = contact.querySelector(".contact-sub");
      if (text && site.contact.text) text.textContent = site.contact.text;

      const link = contact.querySelector(".contact-email-link");
      if (link && site.contact.email) {
        link.href = `mailto:${site.contact.email}`;
        const textNode = [...link.childNodes]
          .reverse()
          .find(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
          );
        if (textNode) textNode.textContent = ` ${site.contact.email} `;
      }
    }
  } catch (error) {
    console.warn(
      "Textes du site non chargés, contenu par défaut conservé :",
      error,
    );
  }
}

async function loadCatalogue() {
  const response = await fetch(CATALOGUE_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();

  categories = (data.categories || [])
    .map((category) =>
      typeof category === "string" ? category : category.name,
    )
    .filter(Boolean);

  /* L'identifiant est attribué automatiquement selon la position dans la liste */
  products = (data.products || [])
    .filter((product) => product.visible !== false)
    .map((product, index) => ({
      ...product,
      id: index + 1,
      price: Number(product.price) || 0,
      description: product.description || "",
      variants: product.variants || [],
      colors: product.colors || [],
    }));
}

/* ==========================================================================
ÉTAT
========================================================================== */

let cart = [];
let selectedProductForModal = null;

/* ==========================================================================
ÉLÉMENTS DU DOM
========================================================================== */

const productsGrid = document.getElementById("productsGrid");
const categoryFilters = document.getElementById("categoryFilters");

const cartCount = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const closeCartBg = document.getElementById("closeCartBg");
const cartItemsList = document.getElementById("cartItemsList");
const cartTotalPrice = document.getElementById("cartTotalPrice");

const goToCheckoutBtn = document.getElementById("goToCheckoutBtn");
const cartStep1 = document.getElementById("cartStep1");
const cartStep2 = document.getElementById("cartStep2");
const backToCartBtn = document.getElementById("backToCartBtn");

/* ==========================================================================
MODALE PRODUIT
========================================================================== */

const productModal = document.getElementById("productModal");
const closeProductModalBtn = document.getElementById("closeProductModalBtn");
const closeProductModalBg = document.getElementById("closeProductModalBg");

const modalImg = document.getElementById("modalImg");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalDescription = document.getElementById("modalDescription");

const variantGroup = document.getElementById("variantGroup");
const modalVariantSelect = document.getElementById("modalVariantSelect");
const modalQty = document.getElementById("modalQty");
const modalAddToCartBtn = document.getElementById("modalAddToCartBtn");

/* ==========================================================================
FORMULAIRE
========================================================================== */

const orderForm = document.getElementById("orderForm");
const hiddenOrderSummary = document.getElementById("hiddenOrderSummary");
const hiddenOrderTotal = document.getElementById("hiddenOrderTotal");
const formStatusMessage = document.getElementById("formStatusMessage");

/* ==========================================================================
NAVIGATION MOBILE
========================================================================== */

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navLinks = document.getElementById("navLinks");

/* ==========================================================================
INITIALISATION
========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();

  const yearElement = document.getElementById("year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  updateCartUI();
  loadSiteContent();

  try {
    await loadCatalogue();
    renderCategoryFilters();
    renderProducts("all");
  } catch (error) {
    console.error("Impossible de charger le catalogue :", error);
    if (productsGrid) {
      productsGrid.innerHTML =
        '<p class="text-center" style="grid-column:1/-1;color:var(--color-text-muted)">Les produits ne peuvent pas être affichés pour le moment. Merci de réessayer dans quelques instants.</p>';
    }
  }
});

/* ==========================================================================
FILTRES DE CATÉGORIES (générés depuis le catalogue)
========================================================================== */

function renderCategoryFilters() {
  if (!categoryFilters) return;

  /* Uniquement les catégories qui contiennent au moins un produit visible */
  const used = new Set(products.map((p) => p.category.toLowerCase()));
  const visibleCategories = categories.filter((c) => used.has(c.toLowerCase()));

  categoryFilters.innerHTML = "";

  const all = document.createElement("button");
  all.type = "button";
  all.className = "filter-btn active";
  all.dataset.category = "all";
  all.textContent = "Toutes";
  categoryFilters.appendChild(all);

  visibleCategories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-btn";
    button.dataset.category = category;
    button.textContent = category;
    categoryFilters.appendChild(button);
  });
}

/* ==========================================================================
AFFICHAGE DES PRODUITS
========================================================================== */

function renderProducts(filterCategory) {
  if (!productsGrid) return;

  productsGrid.innerHTML = "";

  const filteredProducts =
    filterCategory === "all"
      ? products
      : products.filter(
          (product) =>
            (product.category || "").toLowerCase() ===
            filterCategory.toLowerCase(),
        );

  if (filteredProducts.length === 0) {
    productsGrid.innerHTML =
      '<p class="text-center" style="grid-column:1/-1;color:var(--color-text-muted)">Aucun produit dans cette catégorie pour le moment.</p>';
    return;
  }

  filteredProducts.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
<div class="product-image-container">
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
</div> 

<div class="product-info"> 
    <span class="product-category">${escapeHtml(product.category)}</span> 
    <h3 class="product-name">${escapeHtml(product.name)}</h3> 
    <p class="product-desc-short">${escapeHtml(shortDescription(product.description))}</p> 

    <div class="product-bottom"> 
        <span class="product-price">${formatPrice(product.price)}</span> 
        <button type="button" class="btn-order-card" data-product-id="${product.id}">
            Voir / Commander
        </button> 
    </div> 
</div>
`;

    productsGrid.appendChild(card);
  });
}

/* Description courte : les "..." ne sont ajoutés que si le texte est coupé */
function shortDescription(text, max = 65) {
  const clean = (text || "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "...";
}

/* ==========================================================================
OUVERTURE DE LA FICHE PRODUIT
========================================================================== */

function openProductModal(productId) {
  const product = products.find((product) => product.id === Number(productId));

  if (!product) {
    console.error("Produit introuvable :", productId);
    return;
  }

  selectedProductForModal = product;

  if (modalImg) {
    modalImg.src = product.image;
    modalImg.alt = product.name;
  }

  if (modalCategory) {
    modalCategory.textContent = product.category;
  }

  if (modalTitle) {
    modalTitle.textContent = product.name;
  }

  if (modalPrice) {
    modalPrice.textContent = formatPrice(product.price);
  }

  if (modalDescription) {
    modalDescription.textContent = product.description;
  }

  if (modalQty) {
    modalQty.value = 1;
  }

  /* Nettoyage complet des variantes */
  if (variantGroup) {
    variantGroup.innerHTML = "";
    variantGroup.style.display = "none";
  }

  if (modalVariantSelect) {
    modalVariantSelect.innerHTML = "";
    modalVariantSelect.style.display = "none";
  }

  /* ----------------------------------------------------------------------
PRODUITS À CHOIX MULTIPLES + COULEUR (ex : stickers)
---------------------------------------------------------------------- */

  if (isMultiChoice(product)) {
    const title = document.createElement("div");
    title.textContent = product.variants_label
      ? `${getVariantLabel(product)} :`
      : "Choisis tes matières :";
    title.style.cssText = "display:block; margin-bottom:12px; font-weight:600;";
    variantGroup.appendChild(title);

    const checkboxClass = "school-subject-checkbox";

    product.variants.forEach((variant) => {
      const label = document.createElement("label");
      label.style.cssText = "display:block; margin-bottom:7px; cursor:pointer;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = variant;
      checkbox.className = checkboxClass;

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${variant}`));

      variantGroup.appendChild(label);
    });

    /* Couleur */

    const colorTitle = document.createElement("div");
    colorTitle.textContent = "Choisis ta couleur :";
    colorTitle.style.cssText =
      "display:block; margin-top:15px; margin-bottom:8px; font-weight:600;";
    variantGroup.appendChild(colorTitle);

    const colorSelect = document.createElement("select");
    colorSelect.id = "dynamicColorSelect";
    colorSelect.style.width = "100%";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Choisir une couleur --";
    colorSelect.appendChild(defaultOption);

    (product.colors || []).forEach((color) => {
      const option = document.createElement("option");
      option.value = color;
      option.textContent = color;
      colorSelect.appendChild(option);
    });

    variantGroup.appendChild(colorSelect);
    variantGroup.style.display = "block";
  } else if (product.variants && product.variants.length > 0) {
    /* ----------------------------------------------------------------------
AUTRES PRODUITS AVEC VARIANTE
---------------------------------------------------------------------- */
    const title = document.createElement("div");
    title.textContent = product.variants_label
      ? `${getVariantLabel(product)} :`
      : "Choisis une option :";
    title.style.cssText = "display:block; margin-bottom:8px; font-weight:600;";

    const select = document.createElement("select");
    select.id = "dynamicVariantSelect";
    select.style.width = "100%";

    product.variants.forEach((variant) => {
      const option = document.createElement("option");
      option.value = variant;
      option.textContent = variant;
      select.appendChild(option);
    });

    variantGroup.appendChild(title);
    variantGroup.appendChild(select);
    variantGroup.style.display = "block";
  }

  /* Affichage de la modale */

  if (productModal) {
    productModal.classList.add("active");
  }
}

/* ==========================================================================
FERMETURE DE LA FICHE PRODUIT
========================================================================== */

function closeProductModal() {
  if (productModal) {
    productModal.classList.remove("active");
  }

  selectedProductForModal = null;
}

/* ==========================================================================
AJOUT AU PANIER
========================================================================== */

function addToCart(product, quantity, selectedVariant, selectedColor) {
  const colorKey = selectedColor || "default";
  const variantKey = Array.isArray(selectedVariant)
    ? [...selectedVariant].sort().join("|")
    : selectedVariant || "default";

  const cartItemId = `${product.id}-${colorKey}-${variantKey}`;

  const existingIndex = cart.findIndex(
    (item) => item.cartItemId === cartItemId,
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({
      cartItemId,
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      variant: selectedVariant || null,
      variantLabel: getVariantLabel(product),
      color: selectedColor || null,
      quantity,
    });
  }

  updateCartUI();

  showToast(`${product.name} ajouté à votre panier !`);
}

/* ==========================================================================
MISE À JOUR DU PANIER
========================================================================== */

function updateCartUI() {
  if (!cartCount || !cartItemsList) return;

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  cartCount.textContent = totalQty;
  cartItemsList.innerHTML = "";

  if (cart.length === 0) {
    cartItemsList.innerHTML =
      '<p style="text-align:center; color:var(--color-text-muted, #777); margin-top:40px;">Votre panier est vide pour le moment.</p>';

    if (goToCheckoutBtn) {
      goToCheckoutBtn.disabled = true;
    }
  } else {
    if (goToCheckoutBtn) {
      goToCheckoutBtn.disabled = false;
    }

    cart.forEach((item, index) => {
      const itemElement = document.createElement("div");
      itemElement.className = "cart-item";

      let optionsHTML = "";

      if (item.variant) {
        const choices = Array.isArray(item.variant)
          ? item.variant.join(", ")
          : item.variant;
        const label = item.variantLabel || "Option";
        optionsHTML += `<div class="cart-item-variant">${escapeHtml(label)} : ${escapeHtml(choices)}</div>`;
      }

      if (item.color) {
        optionsHTML += `<div class="cart-item-variant">Couleur : ${escapeHtml(item.color)}</div>`;
      }

      itemElement.innerHTML = ` 
<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-img"> 

<div class="cart-item-details"> 
    <div class="cart-item-title">${escapeHtml(item.name)}</div> 
    ${optionsHTML} 
    <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div> 

    <div class="cart-item-qty"> 
        <button type="button" class="qty-btn cart-minus" data-index="${index}">-</button> 
        <span>${item.quantity}</span> 
        <button type="button" class="qty-btn cart-plus" data-index="${index}">+</button> 
    </div> 
</div> 

<button type="button" class="cart-item-remove" data-index="${index}" title="Supprimer">&times;</button>
`;

      cartItemsList.appendChild(itemElement);
    });
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cartTotalPrice) {
    cartTotalPrice.textContent = formatPrice(total);
  }
}

/* ==========================================================================
QUANTITÉS
========================================================================== */

function changeQty(index, delta) {
  if (!cart[index]) return;

  cart[index].quantity += delta;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  updateCartUI();
}

/* ==========================================================================
SUPPRESSION PANIER
========================================================================== */

function removeCartItem(index) {
  if (!cart[index]) return;

  cart.splice(index, 1);

  updateCartUI();
}

/* ==========================================================================
RÉSUMÉ DE COMMANDE
========================================================================== */

function prepareOrderSummary() {
  let summary = "DÉTAIL DE LA COMMANDE MAJU'LYAH :\n\n";
  let total = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    summary += `- ${item.name}\n`;

    if (item.variant) {
      const choices = Array.isArray(item.variant)
        ? item.variant.join(", ")
        : item.variant;
      const label = item.variantLabel || "Option";
      summary += `  ${label} : ${choices}\n`;
    }

    if (item.color) {
      summary += `  Couleur : ${item.color}\n`;
    }

    summary += `  Quantité : ${item.quantity} x ${item.price.toFixed(2)}€ = ${itemTotal.toFixed(2)}€\n\n`;
  });

  summary += `TOTAL GLOBAL DE LA COMMANDE : ${total.toFixed(2)} €`;

  if (hiddenOrderSummary) {
    hiddenOrderSummary.value = summary;
  }

  if (hiddenOrderTotal) {
    hiddenOrderTotal.value = `${total.toFixed(2)} €`;
  }
}

/* ==========================================================================
TOAST
========================================================================== */

function showToast(message) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* ==========================================================================
ÉVÉNEMENTS
========================================================================== */

function setupEventListeners() {
  /* ----------------------------------------------------------------------
FILTRES
---------------------------------------------------------------------- */

  if (categoryFilters) {
    categoryFilters.addEventListener("click", (event) => {
      const button = event.target.closest(".filter-btn");
      if (!button) return;

      document
        .querySelectorAll(".filter-btn")
        .forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      renderProducts(button.dataset.category);
    });
  }

  /* ----------------------------------------------------------------------
BOUTONS "VOIR / COMMANDER"
---------------------------------------------------------------------- */

  if (productsGrid) {
    productsGrid.addEventListener("click", (event) => {
      const orderButton = event.target.closest(".btn-order-card");
      if (orderButton) {
        openProductModal(orderButton.dataset.productId);
        return;
      }

      const productImage = event.target.closest(".product-image-container");
      if (productImage) {
        const card = productImage.closest(".product-card");
        if (!card) return;
        const button = card.querySelector(".btn-order-card");
        if (button) openProductModal(button.dataset.productId);
        return;
      }

      const productName = event.target.closest(".product-name");
      if (productName) {
        const card = productName.closest(".product-card");
        if (!card) return;
        const button = card.querySelector(".btn-order-card");
        if (button) openProductModal(button.dataset.productId);
      }
    });
  }

  /* ----------------------------------------------------------------------
MENU MOBILE
---------------------------------------------------------------------- */

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("mobile-open");
    });

    document.querySelectorAll(".nav-item").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("mobile-open");
      });
    });
  }

  /* ----------------------------------------------------------------------
FERMETURE MODALE
---------------------------------------------------------------------- */

  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener("click", closeProductModal);
  }

  if (closeProductModalBg) {
    closeProductModalBg.addEventListener("click", closeProductModal);
  }

  /* ----------------------------------------------------------------------
AJOUT AU PANIER
---------------------------------------------------------------------- */

  if (modalAddToCartBtn) {
    modalAddToCartBtn.addEventListener("click", () => {
      if (!selectedProductForModal) return;

      const qty = Math.max(1, parseInt(modalQty?.value) || 1);
      let selectedVariant = null;
      let selectedColor = null;

      /* CHOIX MULTIPLES + COULEUR (ex : stickers) */
      if (isMultiChoice(selectedProductForModal)) {
        selectedVariant = [];
        const checkboxSelector = ".school-subject-checkbox:checked";

        document.querySelectorAll(checkboxSelector).forEach((checkbox) => {
          selectedVariant.push(checkbox.value);
        });

        const colorSelect = document.getElementById("dynamicColorSelect");
        selectedColor = colorSelect ? colorSelect.value : null;

        if (selectedVariant.length === 0) {
          alert("Merci de sélectionner au moins un choix.");
          return;
        }

        if (!selectedColor) {
          alert("Merci de choisir une couleur.");
          return;
        }
      } else if (
        /* AUTRES PRODUITS */
        selectedProductForModal.variants &&
        selectedProductForModal.variants.length > 0
      ) {
        const select = document.getElementById("dynamicVariantSelect");
        if (select) selectedVariant = select.value;
      }

      addToCart(selectedProductForModal, qty, selectedVariant, selectedColor);
      closeProductModal();
    });
  }

  /* ----------------------------------------------------------------------
PANIER
---------------------------------------------------------------------- */

  if (openCartBtn) {
    openCartBtn.addEventListener("click", () => {
      cartDrawer?.classList.add("active");
    });
  }

  if (closeCartBtn) {
    closeCartBtn.addEventListener("click", () => {
      cartDrawer?.classList.remove("active");
    });
  }

  if (closeCartBg) {
    closeCartBg.addEventListener("click", () => {
      cartDrawer?.classList.remove("active");
    });
  }

  /* ----------------------------------------------------------------------
BOUTONS QUANTITÉ DU PANIER
---------------------------------------------------------------------- */

  if (cartItemsList) {
    cartItemsList.addEventListener("click", (event) => {
      const minus = event.target.closest(".cart-minus");
      if (minus) {
        changeQty(Number(minus.dataset.index), -1);
        return;
      }

      const plus = event.target.closest(".cart-plus");
      if (plus) {
        changeQty(Number(plus.dataset.index), 1);
        return;
      }

      const remove = event.target.closest(".cart-item-remove");
      if (remove) {
        removeCartItem(Number(remove.dataset.index));
      }
    });
  }

  /* ----------------------------------------------------------------------
VALIDATION COMMANDE
---------------------------------------------------------------------- */

  if (goToCheckoutBtn) {
    goToCheckoutBtn.addEventListener("click", () => {
      if (cart.length === 0) return;
      prepareOrderSummary();
      cartStep1?.classList.remove("active");
      cartStep2?.classList.add("active");
    });
  }

  /* ----------------------------------------------------------------------
RETOUR PANIER
---------------------------------------------------------------------- */

  if (backToCartBtn) {
    backToCartBtn.addEventListener("click", () => {
      cartStep2?.classList.remove("active");
      cartStep1?.classList.add("active");
    });
  }

  /* ----------------------------------------------------------------------
FORMULAIRE FORMSPREE
---------------------------------------------------------------------- */

  if (orderForm) {
    orderForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (orderForm.action.includes("VOTRE_ID_FORMSPREE_ICI")) {
        if (formStatusMessage) {
          formStatusMessage.className = "form-status-msg error";
          formStatusMessage.textContent =
            "Attention : Remplacez VOTRE_ID_FORMSPREE_ICI par votre identifiant Formspree.";
        }
        return;
      }

      const formData = new FormData(orderForm);
      const submitBtn = document.getElementById("submitOrderBtn");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Envoi de la commande en cours...";
      }

      try {
        const response = await fetch(orderForm.action, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        if (response.ok) {
          if (formStatusMessage) {
            formStatusMessage.className = "form-status-msg success";
            formStatusMessage.textContent =
              "Merci ! Votre commande a été envoyée avec succès.";
          }

          orderForm.reset();
          cart = [];
          updateCartUI();

          setTimeout(() => {
            cartDrawer?.classList.remove("active");
            cartStep2?.classList.remove("active");
            cartStep1?.classList.add("active");

            if (formStatusMessage) {
              formStatusMessage.className = "form-status-msg";
              formStatusMessage.textContent = "";
            }
          }, 4000);
        } else {
          throw new Error("Erreur Formspree");
        }
      } catch (error) {
        console.error("Erreur d'envoi :", error);

        if (formStatusMessage) {
          formStatusMessage.className = "form-status-msg error";
          formStatusMessage.textContent =
            "Une erreur est survenue lors de l'envoi. Réessayez.";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Valider et envoyer la commande";
        }
      }
    });
  }
}

/* ==========================================================================
FONCTIONS ACCESSIBLES DEPUIS LA PAGE
========================================================================== */

window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.changeQty = changeQty;
window.removeCartItem = removeCartItem;
