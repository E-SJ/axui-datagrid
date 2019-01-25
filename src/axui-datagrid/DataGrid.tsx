import * as React from 'react';

import { DataGridStore } from './providers';
import {
  DataGridEvents,
  DataGridHeader,
  DataGridBody,
  DataGridColumnFilter,
  DataGridScroll,
  DataGridPage,
  DataGridLoader,
} from './components';

import {
  mergeAll,
  makeHeaderTable,
  makeBodyRowTable,
  makeBodyRowMap,
  makeFootSumTable,
  divideTableByFrozenColumnIndex,
} from './utils';
import { IDataGrid } from './common/@types';

interface IProps extends IDataGrid.IProps {}
interface IState extends IDataGrid.IRootState {}

class DataGrid extends React.Component<IProps, IState> {
  static defaultHeight: number = 400;
  static defaultColumnKeys: IDataGrid.IColumnKeys = {
    selected: '_selected_',
    modified: '_modified_',
    deleted: '_deleted_',
    disableSelection: '_disable_selection_',
  };
  static defaultHeader: IDataGrid.IOptionHeader = {
    display: true,
    align: 'left',
    columnHeight: 24,
    columnPadding: 3,
    columnBorderWidth: 1,
    selector: true,
    sortable: true,
    enableFilter: true,
    clickAction: 'sort',
    filterIconClassName: 'datagridIcon-filter',
  };
  static defaultBody: IDataGrid.IOptionBody = {
    align: 'left',
    columnHeight: 24,
    columnPadding: 3,
    columnBorderWidth: 1,
    grouping: false,
    mergeCells: false,
  };
  static defaultPageButtons: IDataGrid.IOptionPageButton[] = [
    { className: 'datagridIcon-first', onClick: 'PAGE_FIRST' },
    { className: 'datagridIcon-prev', onClick: 'PAGE_PREV' },
    { className: 'datagridIcon-back', onClick: 'PAGE_BACK' },
    { className: 'datagridIcon-play', onClick: 'PAGE_PLAY' },
    { className: 'datagridIcon-next', onClick: 'PAGE_NEXT' },
    { className: 'datagridIcon-last', onClick: 'PAGE_LAST' },
  ];
  static defaultPage: IDataGrid.IOptionPage = {
    buttons: DataGrid.defaultPageButtons,
    buttonHeight: 16,
    height: 20,
  };
  static defaultScroller: IDataGrid.IOptionScroller = {
    size: 14,
    arrowSize: 14,
    barMinSize: 12,
    padding: 3,
    horizontalScrollerWidth: 30, // 30%
  };
  static defaultOptions: IDataGrid.IOptions = {
    frozenColumnIndex: 0,
    frozenRowIndex: 0,
    showLineNumber: true,
    multipleSelect: true,
    columnMinWidth: 100,
    lineNumberColumnWidth: 60,
    rowSelectorColumnWidth: 28,
    remoteSort: false,
    header: DataGrid.defaultHeader,
    body: DataGrid.defaultBody,
    page: DataGrid.defaultPage,
    scroller: DataGrid.defaultScroller,
    columnKeys: DataGrid.defaultColumnKeys,
    bodyLoaderHeight: 100,
  };
  static defaultStyles: IDataGrid.IStyles = {
    asidePanelWidth: 0,
    frozenPanelWidth: 0,
    bodyTrHeight: 0,
    elWidth: 0,
    elHeight: 0,
    rightPanelWidth: 0,
    headerHeight: 0,
    bodyHeight: 0,
    frozenPanelHeight: 0,
    footSumHeight: 0,
    pageHeight: 0,
    verticalScrollerWidth: 0,
    horizontalScrollerHeight: 0,
    scrollContentContainerHeight: 0,
    scrollContentHeight: 0,
    scrollContentContainerWidth: 0,
    scrollContentWidth: 0,
    verticalScrollerHeight: 0,
    verticalScrollBarHeight: 0,
    horizontalScrollerWidth: 0,
    horizontalScrollBarWidth: 0,
    scrollerPadding: 0,
    scrollerArrowSize: 0,
    pageButtonsContainerWidth: 0,
  };
  static defaultThrottleWait = 100;

  rootObject: any = {};
  rootNode: React.RefObject<HTMLDivElement>;
  clipBoardNode: React.RefObject<HTMLTextAreaElement>;
  scrollLeft: number = 0;
  scrollTop: number = 0;

  state = {
    mounted: false,
  };

  constructor(props: IProps) {
    super(props);

    this.rootNode = React.createRef();
    this.clipBoardNode = React.createRef();
  }

  getOptions = (options: IDataGrid.IOptions): IDataGrid.IOptions => {
    return mergeAll(true, { ...DataGrid.defaultOptions }, options);
  };

  getProviderProps = (storeProps: IDataGrid.IStoreProps) => {
    const { columns = [], footSum } = this.props;
    const { options = {} } = storeProps;
    const {
      frozenColumnIndex = DataGrid.defaultOptions.frozenColumnIndex || 0,
      body: optionsBody = DataGrid.defaultBody,
    } = options;
    const { columnHeight = 0 } = optionsBody;

    // StoreProvider에 전달해야 하는 상태를 newState에 담는 작업을 시작합니다.
    let newStoreProps: IDataGrid.IStoreProps = { ...storeProps };

    // options.showRowSelector 체크
    if (newStoreProps.rowSelector) {
      if (typeof newStoreProps.rowSelector.show === 'undefined') {
        newStoreProps.rowSelector.show = true;
      }

      if (newStoreProps.options && newStoreProps.rowSelector.show) {
        newStoreProps.options.showRowSelector = true;
      }
    }

    // convert colGroup
    newStoreProps.headerTable = makeHeaderTable(columns, options);
    newStoreProps.bodyRowTable = makeBodyRowTable(columns, options);
    newStoreProps.bodyRowMap = makeBodyRowMap(
      newStoreProps.bodyRowTable || { rows: [] },
      options,
    );

    // header를 위한 divide
    const headerDividedObj = divideTableByFrozenColumnIndex(
      newStoreProps.headerTable || { rows: [] },
      frozenColumnIndex,
      options,
    );

    // body를 위한 divide
    const bodyDividedObj = divideTableByFrozenColumnIndex(
      newStoreProps.bodyRowTable || { rows: [] },
      frozenColumnIndex,
      options,
    );

    newStoreProps.asideHeaderData = headerDividedObj.asideData;
    newStoreProps.leftHeaderData = headerDividedObj.leftData;
    newStoreProps.headerData = headerDividedObj.rightData;

    newStoreProps.asideBodyRowData = bodyDividedObj.asideData;
    newStoreProps.leftBodyRowData = bodyDividedObj.leftData;
    newStoreProps.bodyRowData = bodyDividedObj.rightData;

    // colGroupMap, colGroup을 만들고 틀고정 값을 기준으로 나누어 left와 나머지에 저장

    newStoreProps.colGroupMap = {};
    if (newStoreProps.headerTable) {
      newStoreProps.headerTable.rows.forEach((row, ridx) => {
        row.cols.forEach((col, cidx) => {
          if (newStoreProps.colGroupMap) {
            const currentCol: IDataGrid.ICol = {
              key: col.key,
              label: col.label,
              width: col.width, // columns로부터 전달받은 너비값.
              align: col.align,
              colSpan: col.colSpan,
              rowSpan: col.rowSpan,
              colIndex: col.colIndex,
              rowIndex: col.rowIndex,
              formatter: col.formatter,
              editor: col.editor,
            };
            newStoreProps.colGroupMap[col.colIndex || 0] = currentCol;
          }
        });
      });
    }

    newStoreProps.asideColGroup = headerDividedObj.asideColGroup;
    newStoreProps.colGroup = Object.values(newStoreProps.colGroupMap);

    // colGroup이 정의되면 footSum
    if (footSum) {
      newStoreProps.footSumColumns = [...footSum];
      newStoreProps.footSumTable = makeFootSumTable(
        footSum,
        newStoreProps.colGroup,
        options,
      );
      const footSumDividedObj = divideTableByFrozenColumnIndex(
        newStoreProps.footSumTable || { rows: [] },
        frozenColumnIndex,
        options,
      );
      newStoreProps.leftFootSumData = footSumDividedObj.leftData;
      newStoreProps.footSumData = footSumDividedObj.rightData;
    }

    // provider props에서 styles 속성 제외 styles는 내부 state에 의해 관리 되도록 변경
    return newStoreProps;
  };

  public render() {
    const {
      data = [],
      options = {},
      style = {},
      onBeforeEvent,
      onAfterEvent,
      onScrollEnd,
      onRightClick,
      height = DataGrid.defaultHeight,
      width,
      loading = false,
      loadingData = false,
      selection,
      rowSelector,
      scrollLeft,
      scrollTop,
    } = this.props;

    let gridRootStyle = {
      ...{
        height: height,
        width: width,
      },
      ...style,
    };

    return (
      <DataGridStore.Provider
        {...this.getProviderProps({
          loading,
          loadingData,
          data,
          width,
          height,
          selection,
          rowSelector,
          options: this.getOptions(options),
          scrollLeft,
          scrollTop,
          rootNode: this.rootNode,
          clipBoardNode: this.clipBoardNode,
          rootObject: this.rootObject,
          onBeforeEvent,
          onAfterEvent,
          onScrollEnd,
          onRightClick,
        })}
      >
        <div
          tabIndex={-1}
          ref={this.rootNode}
          className="axui-datagrid"
          style={gridRootStyle}
        >
          <div className="axui-datagrid-clip-board">
            <textarea ref={this.clipBoardNode} />
          </div>
          {this.state.mounted && (
            <DataGridEvents>
              <DataGridHeader />
              <DataGridBody />
              <DataGridPage />
              <DataGridScroll />
              <DataGridColumnFilter />
              <DataGridLoader loading={loading} />
            </DataGridEvents>
          )}
        </div>
      </DataGridStore.Provider>
    );
  }

  componentDidMount() {
    // console.log(this.rootNode);

    this.setState({
      mounted: true,
    });
  }
}

export default DataGrid;
