import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";


export const operatorRoutes = {
    list: null,
    get: async function get() {

        appUtils.log(`getOperatorRoutes: start`);
        //const response = await fetch(`./data/operatorRoutes.json`, {
        const response = await fetch(`/services/OperatorRoute/Get`, {
            timeout: 30 * 1000,
            method: "GET"
        });
        if (!response.ok) {
            throw new Error(`Failed to getOperatorRoutes. Error: ${response.status}`);
        }
        const data = await response.json();

        // create operator " - All" items...
        const operatorsAll = data
            .map(o => o.operatorName)
            .filter((value, index, self) => self.indexOf(value) === index)
            .map((operatorName) => {
                return {
                    operatorRef: data
                        .filter((o) => o.operatorName == operatorName)
                        .map((o) => o.operatorRef)
                        .join(),
                    operatorName: operatorName,
                    lineRef: '',
                    route: '',
                    title: `${operatorName} - All Routes`,
                    all: true,
                }
            });

        // create operator/route entries...
        const operatorsRoutes = data.flatMap(o => {

            const operatorRoutes = [];

            o.routes.forEach(r => {
                operatorRoutes.push({
                    operatorRef: o.operatorRef,
                    operatorName: o.operatorName,
                    lineRef: r.lineRef,
                    route: r.route,
                    title: `${o.operatorName} - ${r.route}`,
                    all: false,
                });
            });

            //operatorRoutes = operatorRoutes.filter((r) => (r.operatorName === 'Transport for London'));

            return operatorRoutes;
        });

        // concat the arrays...
        this.list = operatorsAll.concat(operatorsRoutes);

        appUtils.log(`getOperatorRoutes: complete`);
        return true;
    },
};
