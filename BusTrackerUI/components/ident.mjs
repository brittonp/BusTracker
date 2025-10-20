import "./ident.css";
export class Ident {
  #colors = ["#C724B1", "#4D4DFF", "#E0E722", "#FFAD00", "#D22730", "#44D62C"];
  #l = 87;
  content;

  constructor(title) {
    const ident = document.createElement("div");
    ident.className = "ident";

    const box = this.#createAssembly();

    box.appendChild(this.#createFace(-1, -1, 1, 0, 0, 0, 1));
    box.appendChild(this.#createFace(-1, 1, -1, 2, 0, 0, 6));

    box.appendChild(this.#createFace(-1, -1, -1, 0, -1, 0, 2));
    box.appendChild(this.#createFace(1, 1, -1, 0, 1, 2, 5));

    box.appendChild(this.#createFace(-1, -1, -1, 1, 0, 0, 3));
    box.appendChild(this.#createFace(-1, 1, 1, -1, 0, 0, 4));

    ident.appendChild(box);
    ident.appendChild(this.#createTitle(title));

    this.content = ident;
  }

  // Assembiles are for grouping faces and other assemblies
  #createAssembly() {
    var assembly = document.createElement("div");
    assembly.className = "threedee assembly";
    return assembly;
  }

  #createFace(px, py, pz, rx, ry, rz, index) {
    const l = this.#l;
    const r = l / 2;
    const face = document.createElement("div");

    face.className = "face";
    face.style.cssText = `
            background: linear-gradient(to bottom right, ${
              this.#colors[index - 1]
            } 0%, #ffffff 100%);
            width: ${l}px;
            height: ${l}px;
            transform: translate3d(${r * px}px, ${r * py}px,${
      r * pz
    }px) rotateX(${90 * rx}deg) rotateY(${90 * ry}deg) rotateZ(${90 * rz}deg);
            font-size: ${r}px;
            font-family: Arial, Helvetica, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;`;

    return face;
  }

  #createTitle(title) {
    const l = this.#l;

    var titleEl = document.createElement("div");
    titleEl.className = "ident title";
    titleEl.style.cssText = `
            height: ${l * 2.5}px;`;
    titleEl.innerHTML = title;
    return titleEl;
  }

  setText(text) {
    this.content.querySelectorAll(".face").forEach((node) => {
      node.innerHTML = text;
    });
  }
}
