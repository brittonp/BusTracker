﻿import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";


export const operatorRoutes = {
    operators: null,
    routes: null,
    flat: null,
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

        this.routes = data;
        this.operators = data.map(o => {
            return {
                operatorRef: o.operatorRef,
                operatorName: o.operatorName,
            }
        });
        this.flat = data.flatMap(o => {

            const operatorRoutes = [];

            operatorRoutes.push({
                operatorRef: o.operatorRef,
                operatorName: o.operatorName,
                lineRef: '',
                route: '',
                title: `${o.operatorName} - All Routes`
            });

            o.routes.forEach(r => {
                operatorRoutes.push({
                    operatorRef: o.operatorRef,
                    operatorName: o.operatorName,
                    lineRef: r.lineRef,
                    route: r.route,
                    title: `${o.operatorName} - ${r.route}`
                });
            });

            //operatorRoutes = operatorRoutes.filter((r) => (r.operatorName === 'Transport for London'));

            return operatorRoutes;
        });

        appUtils.log(`getOperatorRoutes: complete`);
        return true;
        //return this.routes; // JSON.parse(data);
    },
};
