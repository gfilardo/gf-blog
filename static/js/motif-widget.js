import { generateArticleMotif } from './motif.mjs';

/**
 * Reusable interactive widget instance for article motif demonstration and exploration.
 * Allows live switching of algorithm and seed via dropdowns with instant client-side SVG re-rendering.
 */
class MotifWidget extends HTMLElement {
  connectedCallback() {
    this.slug = this.dataset.slug;
    this.date = this.dataset.date;
    this.defaultAlgo = this.dataset.defaultAlgorithm;
    this.defaultSeed = Number(this.dataset.defaultSeed);

    this.currentAlgo = this.defaultAlgo;
    this.currentSeed = this.defaultSeed;

    this.selectAlgo = this.querySelector('.motif-select-algo');
    this.selectSeed = this.querySelector('.motif-select-seed');
    this.hexDisplay = this.querySelector('.motif-hex-display');
    this.btnReset = this.querySelector('.motif-btn-reset');
    this.btnCopy = this.querySelector('.motif-btn-copy');

    this.heroFrame = this.querySelector('.motif-frame-hero');
    this.markFrame = this.querySelector('.motif-frame-mark');
    this.microFrame = this.querySelector('.motif-frame-micro .article-motif-mark') || this.querySelector('.motif-frame-micro');

    if (this.selectAlgo) {
      this.selectAlgo.addEventListener('change', () => this.onAlgoChange());
    }

    if (this.selectSeed) {
      this.selectSeed.addEventListener('change', () => this.onSeedChange());
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.resetToDefault());
    }

    if (this.btnCopy) {
      this.btnCopy.addEventListener('click', () => this.copyYaml());
    }
  }

  onAlgoChange() {
    this.currentAlgo = this.selectAlgo.value;
    this.renderMotifs();
  }

  onSeedChange() {
    const val = this.selectSeed.value;
    if (val === 'random') {
      const randomSeed = Math.floor(Math.random() * 4294967296);
      this.setCustomSeed(randomSeed);
    } else if (val === 'custom') {
      const input = prompt('Enter 32-bit unsigned integer seed:', String(this.currentSeed));
      if (input !== null) {
        const num = parseInt(input.trim(), 10);
        if (!isNaN(num) && num >= 0) {
          this.setCustomSeed(num >>> 0);
        } else {
          this.selectSeed.value = String(this.currentSeed);
        }
      } else {
        this.selectSeed.value = String(this.currentSeed);
      }
    } else {
      this.currentSeed = Number(val) >>> 0;
      this.renderMotifs();
    }
  }

  setCustomSeed(newSeed) {
    this.currentSeed = newSeed;
    let opt = Array.from(this.selectSeed.options).find(o => o.value === String(newSeed));
    if (!opt) {
      opt = document.createElement('option');
      opt.value = String(newSeed);
      opt.textContent = `${newSeed} (Custom)`;
      const optGroup = this.selectSeed.querySelector('optgroup');
      if (optGroup) {
        this.selectSeed.insertBefore(opt, optGroup);
      } else {
        this.selectSeed.appendChild(opt);
      }
    }
    this.selectSeed.value = String(newSeed);
    this.renderMotifs();
  }

  renderMotifs() {
    const doc = {
      slug: this.slug,
      date: this.date,
      motif: {
        algorithm: this.currentAlgo,
        seed: this.currentSeed
      }
    };

    const heroSvg = generateArticleMotif(doc, { form: 'hero', width: 360, height: 80 });
    const markSvg = generateArticleMotif(doc, { form: 'mark', width: 120, height: 120 });

    if (this.heroFrame) this.heroFrame.innerHTML = heroSvg;
    if (this.markFrame) this.markFrame.innerHTML = markSvg;
    if (this.microFrame) this.microFrame.innerHTML = markSvg;

    if (this.hexDisplay) {
      this.hexDisplay.textContent = '0x' + this.currentSeed.toString(16).toUpperCase();
    }

    const isModified = this.currentAlgo !== this.defaultAlgo || this.currentSeed !== this.defaultSeed;
    if (this.btnReset) {
      this.btnReset.hidden = !isModified;
    }
  }

  resetToDefault() {
    this.currentAlgo = this.defaultAlgo;
    this.currentSeed = this.defaultSeed;
    if (this.selectAlgo) this.selectAlgo.value = this.defaultAlgo;
    if (this.selectSeed) this.selectSeed.value = String(this.defaultSeed);
    this.renderMotifs();
  }

  async copyYaml() {
    const yaml = `motif:\n  algorithm: ${this.currentAlgo}\n  seed: ${this.currentSeed}`;
    try {
      await navigator.clipboard.writeText(yaml);
      const originalText = this.btnCopy.textContent;
      this.btnCopy.textContent = 'Copied!';
      setTimeout(() => {
        this.btnCopy.textContent = originalText;
      }, 1500);
    } catch {
      prompt('Copy frontmatter override:', yaml);
    }
  }
}

if (!customElements.get('motif-widget')) {
  customElements.define('motif-widget', MotifWidget);
}
