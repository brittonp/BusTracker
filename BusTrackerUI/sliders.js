export class Slider {

    panel;
    #controlBar;
    #content;
    #y;
    #dy;
    #ht;
    #resizeHandle;
    #collapserButton;
    #hiderButton;

    constructor({ parent, content, autoExpand = false }) {

        let panel = document.createElement('div');
        panel.className = 'slider-panel';

        this.#controlBar = document.createElement('div');
        this.#controlBar.className = 'control-bar';

        this.#resizeHandle = document.createElement('div');
        this.#resizeHandle.className = 'handle';
        this.#controlBar.appendChild(this.#resizeHandle);

        this.#hiderButton = document.createElement('div');
        this.#hiderButton.className = 'hider';
        this.#hiderButton.innerHTML = 'X';
        this.#controlBar.appendChild(this.#hiderButton);

        this.#collapserButton = document.createElement('div');
        this.#collapserButton.className = 'collapser';
        this.#collapserButton.innerHTML = '&#8964;';
        this.#controlBar.appendChild(this.#collapserButton);

        panel.appendChild(this.#controlBar);

        this.#content = document.createElement('div');
        this.#content.replaceChildren(content);

        panel.appendChild(this.#content);

        this.panel = panel;
        parent.appendChild(this.panel);

        if (autoExpand == true) {
            this.panel.classList.add('auto');
        }

        this.#addListeners();

    }

    #addListeners() {

        let thisPanel = this;

        // Pointer events on handle...
        this.panel.addEventListener('pointerdown', addPointListeners);

        function addPointListeners(e) {
            thisPanel.#y = e.screenY;
            thisPanel.#ht = thisPanel.panel.clientHeight;

            thisPanel.panel.addEventListener('pointermove', resize, false);
            thisPanel.panel.addEventListener('pointerup', removePointListeners, false);

            //e.preventDefault();
        }

        function resize(e) {
            //console.log(e.screenY);
            if (!thisPanel.panel.classList.contains('auto')) {

                thisPanel.#dy = e.screenY - thisPanel.#y;
                thisPanel.#y = e.screenY;
                thisPanel.#ht -= thisPanel.#dy;

                if (thisPanel.#ht >= thisPanel.panel.parentElement.clientHeight) {
                    thisPanel.panel.classList.add('full');
                } else {
                    thisPanel.panel.style.height = thisPanel.#ht + "px";
                }

            }
        }

        function removePointListeners(e) {

            thisPanel.panel.removeEventListener('pointermove', resize, false);
            thisPanel.panel.removeEventListener('pointerup', removePointListeners, false);

            e.preventDefault();
        }

        // Click event on handle...
        this.#resizeHandle.addEventListener('click', (e) => {
            this.panel.classList.add('full');
        });

        // Click event on collapser...
        this.#collapserButton.addEventListener('click', (e) => {
            this.panel.classList.remove('full');
            this.panel.style.height = '';
        });

        // Click event on hider...
        this.#hiderButton.addEventListener('click', (e) => {
            this.panel.classList.remove('show');
        });


    }

    show() {
        this.panel.classList.add('show');
    }

    setContent(newContent) {
        this.#content.replaceChildren(newContent);
    }

}
