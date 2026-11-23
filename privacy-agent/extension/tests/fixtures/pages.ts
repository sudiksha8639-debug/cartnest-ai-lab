import { JSDOM } from "jsdom";

function shell(main: string, options: { title?: string; url: string; cartCount?: number }): JSDOM {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>${options.title ?? "CartNest"}</title></head><body>
      <header>
        <a href="/" aria-label="CartNest home">CartNest</a>
        <form role="search">
          <label for="product-search-input" class="sr-only">Search products</label>
          <input id="product-search-input" name="product_search" placeholder="Search for headphones, skincare, bags…" autocomplete="off" value="" />
          <button type="submit" aria-label="Search products">Search</button>
        </form>
        <a href="/account" aria-label="Open account menu">My account</a>
        <a href="/cart" aria-label="Shopping cart with ${options.cartCount ?? 0} items" data-testid="cart-link">Cart <span data-testid="cart-count">${options.cartCount ?? 0}</span></a>
      </header>
      <main>${main}</main>
      <footer><p>Free delivery over ₹999. Demo storefront with synthetic data.</p></footer>
    </body></html>`,
    { url: options.url, pretendToBeVisual: true },
  );
  return dom;
}

export function homePage(): JSDOM {
  return shell(
    `<h1>Considered essentials, delivered with care.</h1>
     <h2>Shop by category</h2>
     <a href="/shop?category=Electronics">Electronics</a>
     <a href="/shop?category=Fashion">Fashion</a>
     <section>
       <h2>Trending now</h2>
       <article>
         <a href="/product/airwave-pro-anc-headphones" aria-label="View Airwave Pro ANC Headphones">Image</a>
         <p>Airwave · Electronics</p>
         <a href="/product/airwave-pro-anc-headphones">Airwave Pro ANC Headphones</a>
         <p>4.7 (1,204)</p>
         <span>₹8,999</span>
         <button type="button" aria-label="Add Airwave Pro ANC Headphones to cart">Add to cart</button>
       </article>
     </section>`,
    { url: "http://localhost:5173/", title: "CartNest — Everything you love" },
  );
}

export function shopPage(): JSDOM {
  return shell(
    `<h1 data-testid="shop-heading">Results for “wireless”</h1>
     <p data-testid="results-count">2 products found for your search</p>
     <label for="sort-products">Sort by</label>
     <button id="sort-products" role="combobox" aria-label="Sort products">Relevance</button>
     <aside>
       <h2>Filters</h2>
       <form>
         <label for="filter-min-price">Min (₹)</label>
         <input id="filter-min-price" name="min_price" inputmode="numeric" placeholder="0" value="" />
         <label for="filter-max-price">Max (₹)</label>
         <input id="filter-max-price" name="max_price" inputmode="numeric" placeholder="100000" value="" />
         <button type="submit" data-testid="apply-price-filter">Apply price</button>
       </form>
       <button type="button">4.5 & above</button>
     </aside>
     <article data-product-id="airwave">
       <a href="/product/airwave-pro-anc-headphones" aria-label="View Airwave Pro ANC Headphones">Image</a>
       <p>Airwave · Electronics</p>
       <h3><a href="/product/airwave-pro-anc-headphones">Airwave Pro ANC Headphones</a></h3>
       <p>4.7 (1,204)</p>
       <span>₹8,999</span><span>₹11,999</span>
       <button type="button" aria-label="Add Airwave Pro ANC Headphones to cart">Add to cart</button>
     </article>
     <article data-product-id="pulse">
       <a href="/product/pulse-buds-mini" aria-label="View Pulse Buds Mini">Image</a>
       <p>Pulse · Electronics</p>
       <h3><a href="/product/pulse-buds-mini">Pulse Buds Mini</a></h3>
       <p>4.3 (874)</p>
       <span>₹2,499</span><span>₹3,999</span>
       <button type="button" aria-label="Add Pulse Buds Mini to cart">Add to cart</button>
     </article>`,
    { url: "http://localhost:5173/shop?q=wireless", title: "Shop — CartNest", cartCount: 0 },
  );
}

export function productPage(): JSDOM {
  return shell(
    `<nav aria-label="Breadcrumb"><a href="/shop">Shop</a></nav>
     <div data-testid="product-detail">
       <h1 data-testid="product-title">Pulse Buds Mini</h1>
       <p>Pulse · Electronics</p>
       <p aria-label="Rated 4.3 out of 5 from 874 reviews">4.3 (874)</p>
       <span data-testid="product-price">₹2,499</span>
       <span data-testid="product-stock">In stock</span>
       <p>Featherlight true-wireless earbuds with punchy bass and a pocketable charging case.</p>
       <button type="button" aria-label="Add Pulse Buds Mini to cart" data-testid="detail-add-to-cart">Add to cart</button>
       <button type="button" data-testid="detail-buy-now">Buy now</button>
       <p>Demo payments only. Checkout is not automated.</p>
     </div>
     <section><h2>Customer reviews</h2><p>Excellent sound for the price.</p></section>`,
    { url: "http://localhost:5173/product/pulse-buds-mini", title: "Pulse Buds Mini — CartNest", cartCount: 0 },
  );
}

export function cartPage(): JSDOM {
  return shell(
    `<h1 data-testid="cart-heading">Your cart</h1>
     <p>1 item · prices include all taxes</p>
     <article data-testid="cart-item-pulse-buds-mini">
       <a href="/product/pulse-buds-mini" aria-label="View Pulse Buds Mini">Image</a>
       <p>Pulse</p>
       <h2><a href="/product/pulse-buds-mini">Pulse Buds Mini</a></h2>
       <p>Electronics · In stock</p>
       <p>₹2,499</p>
     </article>
     <aside>
       <h2>Order summary</h2>
       <p>Subtotal (1 items)</p><p>₹2,499</p>
       <a href="/checkout" data-testid="cart-checkout">Proceed to checkout</a>
     </aside>`,
    { url: "http://localhost:5173/cart", title: "Your cart — CartNest", cartCount: 1 },
  );
}

export function accountPage(): JSDOM {
  return shell(
    `<p>Customer dashboard</p>
     <h1 data-testid="account-name">Ananya Deshpande</h1>
     <p data-testid="account-email">ananya.deshpande@example.com</p>
     <p data-testid="account-phone">+91 98200 45512</p>
     <section>
       <h2>Saved addresses</h2>
       <p data-testid="profile-default-address">Home · Flat 4B, Palm Grove, Juhu Road, Mumbai 400049</p>
       <p>Office · 22 Cyber City, Gurugram, Haryana 122002</p>
     </section>
     <section>
       <h2>Profile</h2>
       <form>
         <label for="profile_name">Full name</label>
         <input id="profile_name" name="name" value="Ananya Deshpande" />
         <label for="profile_email">Email address</label>
         <input id="profile_email" name="customer_email" type="email" value="ananya.deshpande@example.com" />
         <label for="profile_phone">Phone number</label>
         <input id="profile_phone" name="phone" type="tel" value="+91 98200 45512" />
         <label for="address_house">House / flat number</label>
         <input id="address_house" name="house_number" value="Flat 4B" />
         <label for="address_street">Street address</label>
         <input id="address_street" name="street_address" value="Palm Grove, Juhu Road" />
         <label for="address_postal">PIN code</label>
         <input id="address_postal" name="postal_code" value="400049" />
         <button type="submit">Save profile</button>
       </form>
     </section>`,
    { url: "http://localhost:5173/account", title: "My Account — CartNest", cartCount: 0 },
  );
}
