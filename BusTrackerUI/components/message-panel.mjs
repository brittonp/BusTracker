export class MessagePanel {
  constructor(options = null) {
    let actions = "";

    const defaultOptions = {
      className: "app",
      innerHtml: null,
      actions: null,
      closeAction: false,
    };

    options = {
      ...defaultOptions,
      ...options,
    };

    const el = document.createElement("div");

    // default close button handler...
    if (options.closeAction) {
      $(el).on("click", ".close.button", (e) => {
        this.hide();
      });
    }

    // build actions...
    if (options.actions) {
      options.actions.forEach((a) => {
        actions += `<div class="ui ${a.className} button">${a.label}</div>`;

        $(el).on("click", `.ui.${a.className}.button`, (e) => {
          a.action();
          this.hide();
        });
      });
    }

    el.className = `${options.className} shadow screen-message hidden`;
    el.innerHTML = `<div class="box">
            <div class="center row">
                <div class="message-content">
                    ${options.innerHtml}
                </div>
            </div>
            <div class="right row">
                <div class="actions">
                    ${
                      options.closeAction
                        ? '<div class="ui close button">Close</div>'
                        : ""
                    }
                    ${actions}
                </div>                
            </div>
        </div>`;

    document.body.appendChild(el);

    this.display = function (content) {
      $(el).find(".message-content").html(content);
      $(el).removeClass("hidden");

      if (!options.closeAction) {
        setTimeout(() => {
          this.hide();
        }, 5000);
      }
    };
    this.hide = function () {
      $(el).addClass("hidden");
    };
  }
}
