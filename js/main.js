(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav-main");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Header shadow on scroll
  var header = document.querySelector(".site-header");
  if (header) {
    window.addEventListener("scroll", function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    });
  }

  // Animated counters (hero stats + phone-card stats)
  var counters = document.querySelectorAll("[data-counter]");

  function animateCounter(el) {
    var raw = el.getAttribute("data-counter");
    var match = raw.match(/^([\d,]*\.?\d+)(.*)$/);
    if (!match) return;

    var numStr = match[1];
    var suffix = match[2];
    var end = parseFloat(numStr.replace(/,/g, ""));
    var decimals = numStr.indexOf(".") > -1 ? numStr.split(".")[1].length : 0;
    var useCommas = numStr.indexOf(",") > -1;
    var duration = 1400;
    var start = null;

    function frame(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = end * eased;
      var text = value.toFixed(decimals);
      if (useCommas) text = Number(text).toLocaleString("en-IN");
      el.textContent = text + suffix;

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = raw;
      }
    }

    window.requestAnimationFrame(frame);
  }

  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var counterObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      counters.forEach(function (el) {
        counterObserver.observe(el);
      });
    } else {
      counters.forEach(animateCounter);
    }
  }

  // Shared render helpers. Exposed on window.FMI (below) so page-specific
  // inline scripts can reuse them without duplicating this code per page.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderFromJson(selector, render, onRendered) {
    var grid = document.querySelector(selector);
    if (!grid) return;

    var src = grid.getAttribute("data-source");
    if (!src) return;

    fetch(src)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + src);
        return res.json();
      })
      .then(function (items) {
        if (grid.hasAttribute("data-reverse")) {
          items = items.slice().reverse();
        }

        var exclude = (grid.getAttribute("data-exclude") || "")
          .split(",")
          .map(function (s) { return s.trim(); })
          .filter(Boolean);
        if (exclude.length) {
          items = items.filter(function (item) { return exclude.indexOf(item.slug) === -1; });
        }

        var limit = parseInt(grid.getAttribute("data-limit") || "", 10);
        if (!isNaN(limit)) {
          items = grid.hasAttribute("data-tail") ? items.slice(-limit) : items.slice(0, limit);
        }

        grid.innerHTML = items.map(function (item) { return render(item, grid); }).join("");
        if (typeof onRendered === "function") onRendered(grid, items);
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  // Shared helpers used by page-specific inline <script> blocks (see
  // index.html, find-influencer.html, campaigns.html, blog.html and every
  // blog/*.html post).
  window.FMI = {
    escapeHtml: escapeHtml,
    renderFromJson: renderFromJson
  };
})();
