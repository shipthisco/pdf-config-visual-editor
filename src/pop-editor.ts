import { LitElement, css, html } from "lit";
import interact from 'interactjs'
import { customElement, property, state } from "lit/decorators.js";
import { PDFDocumentProxy, GlobalWorkerOptions, getDocument, PageViewport } from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';


@customElement('pop-editor')
class PopEditor extends LitElement {
  static styles = css`
  :host {
    display: block; 
    margin: 0;
    padding: 0;
  }

  .draggable {
    position: absolute;
    width: 30px;
    height: 30px;
    background-color: #29e;
    color: white;
  }

  #the-canvas {
    border: 1px solid black;
  }
  `

  @property() data: any;
  @property() url: string = '';
  @property({type: Array}) fields: string[] = [];

  @property({type: Number}) scale = 1;
  @property({type: Number}) rotation = 0;
  @property({type: Number}) pageNum = 1; //must be number
  @property({type: Number}) totalPage = 0;

  hostClientHeight: number | undefined;
  hostClientWidth: number | undefined;

  canvas: any;
  page_num = 0;
  pageCount = 0;
  pdfDoc: PDFDocumentProxy | undefined;
  pageRendering = false;
  pageNumPending: number | undefined;
  pages = [];
  
  @state() isInitialised = false;
  @state() position = { x: 0, y: 0 };
  @state() viewport: PageViewport | undefined;

  readonly minScale = 1.0;
  readonly maxScale = 2.3;

  constructor() {
    super();
    GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.initialLoad();
  }

  renderPage(num: number) {
    this.pageRendering = true;
    // Using promise to fetch the page
    console.log('rendering...');

    if (!this.pdfDoc) {
      return;
    }

    this.pdfDoc.getPage(num).then((page) => {
      this.viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
      const viewport = this.viewport;
      if (!this.shadowRoot) {
        return;
      }
      this.canvas = this.shadowRoot.getElementById('the-canvas');
      const canvasContext = this.canvas.getContext("2d");
      this.canvas.height = viewport.height;
      this.canvas.width = viewport.width;

      // Render PDF page into canvas context
      const renderContext = {
        canvasContext,
        viewport,
      };
      const renderTask = page.render(renderContext);

      // Wait for rendering to finish
      renderTask.promise.then(() => {
        console.log('Page rendered')
        
        this.dragField('draggable')
      });
    });
  };

  dragField(className: string) {
    interact(`.${className}`).draggable({
      listeners: {
        start: (event) => {
          console.log(event.type, event.target)
        },
        move: (event) => {
          this.position.x += event.dx
          this.position.y += event.dy
    
          event.target.style.transform =
            `translate(${this.position.x}px, ${this.position.y}px)`
        },
      }
    })
  }

  queueRenderPage(num: number) {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.renderPage(num);
    }
  };

  initialLoad() {
    const loadingTask = getDocument({
      ...(this.url && { url: this.url }),
      ...(this.data && { data: this.data }),
    });

    loadingTask.promise
      .then(async (pdfDoc_: PDFDocumentProxy) => {
        this.pdfDoc = pdfDoc_;
        this.isInitialised = true;
        // trigger update
        this.queueRenderPage(this.pageNum);
      })
  };

  getCoordinates() {
    const pos = {
      x: this.position.x,
      y: this.position.y,
    }
    if (this.viewport?.viewBox?.length > 0) {
      const [x, y, width, height] = this.viewport?.viewBox;
      pos.y = (height - ((pos.y * height) / this.viewport?.height)) - 10;
      pos.x = (pos.x * width) / this.viewport?.width;
    }
    return pos
  }

  async modifyPdf() {
    const url = this.url;
    const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
  
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const pos = this.getCoordinates();
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize()

    firstPage.drawText('This text was added with JavaScript!', {
      x: pos.x,
      y: pos.y,
      size: 11,
      font: helveticaFont,
      color: rgb(0.95, 0.1, 0.1),
      // rotate: degrees(-45),
    })
  
    const pdfBytes = await pdfDoc.saveAsBase64()
    return pdfBytes;
  }

  private async _display(e: Event) {
    const data = await this.modifyPdf();
    const blob = new Blob([data]);
    const options = {
      detail: {data, blob},
      bubbles: true,
      composed: true
    };
    this.dispatchEvent(new CustomEvent('modified', options));
  }

  private async _download(e: Event) {
    const data = await this.modifyPdf();
    const blob = new Blob([data]);

    if (this.shadowRoot) {
      const a = document.createElement('a');
      this.shadowRoot.append(a);
      a.download = 'abc.pdf';
      a.href = URL.createObjectURL(blob);
      a.click();
      a.remove();
    }
  }

  // Render the UI as a function of component state
  render() {
    return html`
      <div class="draggable"></div>
      <canvas id="the-canvas"></canvas>
      <button @click="${this._download}">Download</button>
      <button @click="${this._display}">Display</button>

    `;
  }
}