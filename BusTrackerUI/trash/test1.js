import { Slider } from "./sliders.js";

// Document Ready function...
function init() {
  // instantiate and add info slider to content-panel...
  let contentPanel = document.getElementById("content-panel");
  const infoSlider = new Slider({
    parent: contentPanel,
    content: document.getElementById("info-content"),
  });

  //let infoContent = document.getElementById('info-content');
  //infoSlider.setContent(infoContent);

  let showInfoBtn = document.getElementById("show-info");
  showInfoBtn.addEventListener("click", (e) => {
    infoSlider.show();
  });

  // Options panel ...
  const optionsSlider = new Slider({
    parent: document.body,
    content: document.getElementById("options-content"),
    autoExpand: true,
  });

  let showOptionsBtn = document.getElementById("show-options"),
    hideOptionsBtn = document.getElementById("hide-options"),
    optionsPanel = document.getElementById("options-panel");

  showOptionsBtn.addEventListener("click", (e) => {
    //optionsPanel.classList.add('show');
    optionsSlider.show();
  });

  //    hideOptionsBtn.addEventListener('click', (e) => {
  //        optionsPanel.classList.remove('show');
  //    });
}

document.addEventListener("DOMContentLoaded", init);
