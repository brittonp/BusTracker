export class Ident {

    #colors = ["#C724B1", "#4D4DFF", "#E0E722", "#FFAD00", "#D22730", "#44D62C"];
    #l = 87;
    content;

    constructor(l) {
        let box = this.#createAssembly();

        if (l) this.#l = l;

        box.appendChild(this.#createFace(-1, -1, 1, 0, 0, 0, 1));
        box.appendChild(this.#createFace(-1, 1, -1, 2, 0, 0, 6));

        box.appendChild(this.#createFace(-1, -1, -1, 0, -1, 0, 2));
        box.appendChild(this.#createFace(1, 1, -1, 0, 1, 2, 5));

        box.appendChild(this.#createFace(-1, -1, -1, 1, 0, 0, 3));
        box.appendChild(this.#createFace(-1, 1, 1, -1, 0, 0, 4));

        this.content = box;
    }

    // Assembiles are for grouping faces and other assembiles
    #createAssembly() {
        var assembly = document.createElement("div");
        assembly.className = "threedee assembly";
        return assembly;
    }

    #createFace(px, py, pz, rx, ry, rz, index) {
        let l = this.#l;
        let r = l / 2;
        let face = document.createElement("div");

        face.className = 'face threedee';
        face.style.cssText = `
            background: linear-gradient(to bottom right, ${this.#colors[index - 1]} 0%, #ffffff 100%);
            width: ${l}px;
            height: ${l}px;
            transform: translate3d(${r * px}px, ${r * py}px,${r * pz}px) rotateX(${90 * rx}deg) rotateY(${90 * ry}deg) rotateZ(${90 * rz}deg);
            font-size: ${r}px;
            font-family: Arial, Helvetica, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;`;
        //face.innerHTML = index;

        return face;
    }

    setText(text) {
        this.content.querySelectorAll('.face').forEach(node => {
            node.innerHTML = text;
            }
        )
    }
}
