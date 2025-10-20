import { MasterDetailPanel } from "../components/master-detail.mjs";

document.addEventListener("DOMContentLoaded", init);

// Document Ready function...
function init() {
  document.querySelectorAll(".master.panel").forEach(function (ele) {
    //const container = addDetail(ele);

    const container = new MasterDetailPanel({
      content: ele,
      detailClass: "content panel",
    });

    //container.detail.setContent('Hello World');
    container.detail.setContent(`

            <div class="panel row">
                <div class="indicator" title="490006227N">H</div>
                <div class="destination">Tudor Drive<br> </div>
            </div>
            <div class="panel row">
                <table class="ui very basic unstackable striped very compact table">
                    <thead>
                        <tr>
                            <th class="center aligned one wide">Live</th>
                            <th class="center aligned three wide">Mins</th>
                            <th class="center aligned three wide">Route</th>
                            <th class="four wide">Destination</th>
                            <th class="one wide">Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="center aligned one wide">Live</td>
                            <td class="center aligned three wide">3</td>
                            <td class="center aligned  three wide">65</td>
                            <td class="four wide">Ealing Broadway</td>
                            <td class="one wide">TFL</td>
                        </tr><tr>
                            <td class="center aligned one wide">Live</td>
                            <td class="center aligned three wide">12</td>
                            <td class="center aligned  three wide">65</td>
                            <td class="four wide">Ealing Broadway</td>
                            <td class="one wide">TFL</td>
                        </tr><tr>
                            <td class="center aligned one wide">Live</td>
                            <td class="center aligned three wide">19</td>
                            <td class="center aligned  three wide">65</td>
                            <td class="four wide">Ealing Broadway</td>
                            <td class="one wide">TFL</td>
                        </tr><tr>
                            <td class="center aligned one wide">Live</td>
                            <td class="center aligned three wide">26</td>
                            <td class="center aligned  three wide">65</td>
                            <td class="four wide">Ealing Broadway</td>
                            <td class="one wide">TFL</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="panel row right">
                <div><a href="https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service" target="_blank">Powered by TfL Open Data</a></div>
            </div>

 `);
  });

  const mainPanel = document.getElementById("map-panel");
}
