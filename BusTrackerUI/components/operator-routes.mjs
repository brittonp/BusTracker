export const operatorRoutes = {
  list: null,
  get: async function get(apiManager) {
    const data = await apiManager.fetchOperatorLines();

    // create operator " - All" items...
    const operatorsAll = data
      .map((o) => o.operatorName)
      .filter((value, index, self) => self.indexOf(value) === index)
      .map((operatorName) => {
        return {
          operatorRef: data
            .filter((o) => o.operatorName == operatorName)
            .map((o) => o.operatorRef)
            .join(),
          operatorName: operatorName,
          lineRef: "",
          lineName: "",
          title: `${operatorName} - All Routes`,
          all: true,
        };
      });

    const operatorsRoutes = data.flatMap((operator) =>
      operator.lines.map((line) => ({
        operatorRef: operator.operatorRef,
        operatorName: operator.operatorName,
        lineRef: line.lineRef,
        lineName: line.lineName,
        title: `${operator.operatorName} - ${line.lineName}`,
        all: false,
      }))
    );

    // concat the arrays...
    this.list = operatorsAll.concat(operatorsRoutes);
    return true;
  },
};
