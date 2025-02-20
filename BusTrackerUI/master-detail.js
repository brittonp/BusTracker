export class MasterDetailPanel {

    pane;
    detail;   // this is the class object...

    #options = {
        content: '',
    };

    constructor(options) {

        // merge provided options with defaults
        this.#options = {
            ...this.#options,
            ...options
        };

        const master = this.#options.content;

        const parent = master.parentElement;

        // create a new container and reparent the provided element to this new container...
        const container = document.createElement('div');
        container.className = 'container pane';
        container.appendChild(master);

        // for dev purposes create a button to toggle display of slider pane...
        //const showDetailBtn = document.createElement('div');
        //showDetailBtn.textContent = 'Toggle Detail';
        //showDetailBtn.className = 'ui button test show-detail';
        //master.appendChild(showDetailBtn);

        // create a slider pane...
        const detail = new SliderDetailPanel({
            class: this.#options.detailClass
        });

        // add the slider's pane to the new container...
        container.appendChild(detail.pane);

        // add the new container to the provided elements original parent (note this approach assumes the original element had no siblings)...
        parent.appendChild(container);

        // define listener for the dev button
        //showDetailBtn.addEventListener('click', (e) => {
        //    detail.toggle();
        //});

        this.pane = container;
        this.detail = detail;
    }
}

class SliderDetailPanel {

    pane;
    #options = {
        class: 'pane',
    };

    fullExpand = false;

    //#controlBar;
    //#content;

    constructor(options) {

        const thisPanel = this;

        // merge provided options with defaults
        this.#options = {
            ...this.#options,
            ...options
        };

        const pane = document.createElement('div');
        pane.className = 'detail pane';

        const controlBar = document.createElement('div');
        controlBar.className = 'control-bar';

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'handle';
        resizeHandle.addEventListener('click', (e) => {
            thisPanel.full();
        });
        controlBar.appendChild(resizeHandle);
        pane.appendChild(controlBar);

        const content = document.createElement('div');
        content.className = this.#options.class;
        pane.appendChild(content);
        pane.content = content;

        this.pane = pane;

        this.#addListeners();

    }

    #addListeners() {

        const thisPanel = this;

        // The current position of pointer
        let x = 0;
        let y = 0;
        let resizerHeight = 0;

        // Handle the pointerdown event
        // that's triggered when user drags the resizer
        function pointerDownHandler(e) {

            // Get the current pointer position
            x = e.clientX;
            y = e.clientY;
            const resizerRect = thisPanel.pane.getBoundingClientRect();
            resizerHeight = resizerRect.height;

            // Attach the listeners to document
            document.addEventListener('pointermove', pointerMoveHandler);
            document.addEventListener('pointerup', pointerUpHandler);
        };

        function pointerMoveHandler(e) {

            if (e.isPrimary) {

                // How far the pointer has been moved
                const dx = e.clientX - x;
                const dy = e.clientY - y;
                const h =
                    ((resizerHeight - dy) * 100) /
                    thisPanel.pane.parentNode.getBoundingClientRect().height;
                thisPanel.pane.style.height = h + '%';

                const cursor = 'row-resize';
                thisPanel.pane.style.cursor = cursor;
                document.body.style.cursor = cursor;

                document.body.style.userSelect = 'none';
                document.body.style.pointerEvents = 'none';
            }
        };

        function pointerUpHandler(e) {
            thisPanel.pane.style.removeProperty('cursor');
            document.body.style.removeProperty('cursor');

            document.body.style.removeProperty('user-select');
            document.body.style.removeProperty('pointer-events');

            // Remove the handlers of pointermove and pointerup
            document.removeEventListener('pointermove', pointerMoveHandler);
            document.removeEventListener('pointerup', pointerUpHandler);

            const swipeDirection = (e.clientY < y) ? 1 : -1;   // 1==Up, -1==down

            if (swipeDirection == 1) {  // if swipe up...
                thisPanel.full();
            } else {  // else swipe down...
                // if the height of the detail pane > 1/2 of the parent then ...
                if (thisPanel.pane.clientHeight >= (thisPanel.pane.parentElement.clientHeight / 2)) {
                    thisPanel.fit();
                } else { 
                    thisPanel.hide();
                }
            }

        };

        // Attach the handler
        this.pane.addEventListener('pointerdown', pointerDownHandler);
    }

    full() {
        this.pane.style.height = '100%';
        this.fullExpand = true;
    }

    show() {
        this.pane.style.height = '50%';
        this.fullExpand = false;
    }

    fit() {
        const detailPanelScrollHeight = Array.from(this.pane.children).reduce((accumulator, child) => {
            return accumulator + child.scrollHeight
        }, 0);
        this.pane.style.height = Math.min(detailPanelScrollHeight, Math.floor(this.pane.parentElement.clientHeight / 2)) + 'px';
        this.fullExpand = false;
    }

    small() {
        this.pane.style.height = this.pane.children[0].scrollHeight + 'px';
        this.fullExpand = false;
    }

    hide() {
        document.dispatchEvent(new Event('detail-hidden'));
        this.pane.style.height = '0';
        this.fullExpand = false;

    }

    visible() {
        return (this.pane.style.height == '0' ? false : true);
    }

    toggle() {
        if (this.pane.clientHeight > 0) {
            this.hide();
        } else {
            this.fit();
        }
    }

    setContent(newContent) {
        this.pane.content.innerHTML = newContent;
        if (this.fullExpand == false) {
            this.fit();
        }
    }

}
