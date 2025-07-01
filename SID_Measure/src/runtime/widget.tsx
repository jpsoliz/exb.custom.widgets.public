/** @jsx jsx */
/** @jsx jsx */
import {React, AllWidgetProps, jsx} from 'jimu-core';
import {Button, WidgetPlaceholder, utils} from 'jimu-ui';
import { IMConfig } from '../config';
import {JimuMapView, JimuMapViewComponent} from 'jimu-arcgis';
import Measurement from 'esri/widgets/Measurement';
import Point from "esri/geometry/Point";
import GraphicsLayer from "esri/layers/GraphicsLayer";
import Graphic from "esri/Graphic";
import SpatialReference from "esri/geometry/SpatialReference";
import ProjectParameters from "esri/rest/support/ProjectParameters";
import GeometryService from "esri/rest/geometryService";
import esriConfig from "esri/config";
import geometryEngine from "esri/geometry/geometryEngine";
import Polyline from "esri/geometry/Polyline";
import TextSymbol from "esri/symbols/TextSymbol";
import Polygon from "esri/geometry/Polygon";
import {getStyle} from './lib/style';
import defaultMessages from './translations/default';
import PictureMarkerSymbol from 'esri/symbols/PictureMarkerSymbol';

interface State {
  lineBtnActive: boolean;
  areaBtnActive: boolean;
  pointBtnActive: boolean;
  y: number;
  x: number;
  showLocation: boolean;
  showLocHint: boolean;
  showLocResults: boolean;
  cs: string;
  csWKID: number;
  xyStr: string;
  locationStr: string;
  useLocationTool: boolean;
  useDistanceTool: boolean;
  useAreaTool: boolean;
}

const pinIcon = require('./assets/esriGreenPin16x26.png');
const measureIcon = require('./assets/icon.svg')

export default class SID_Measure extends React.PureComponent<AllWidgetProps<IMConfig>, State> {
  apiWidgetContainer: React.RefObject<HTMLDivElement>;
  locationDiv: React.RefObject<HTMLDivElement>;
  measureWidget: Measurement;
  viewClickHandler: IHandle;
  geomService: GeometryService;
  mapView: __esri.MapView | __esri.SceneView;
  drawLayer: GraphicsLayer;
  pointSymbol: PictureMarkerSymbol;

  constructor(props) {
    super(props);
    this.state = {
      lineBtnActive: false,
      areaBtnActive: false,
      pointBtnActive: false,
      y: null,
      x: null,
      showLocation: false,
      showLocHint: false,
      showLocResults: false,
      cs: this.props.config.locationOptions[0].type,
      csWKID: this.props.config.locationOptions[0].wkid || 4326,
      xyStr: "",
      locationStr: "Location (Lat, Lon)",
      useLocationTool: this.props.config.locationTool,
      useDistanceTool: this.props.config.distanceTool,
      useAreaTool: this.props.config.areaTool,
    }
    this.apiWidgetContainer = React.createRef();
    this.locationDiv = React.createRef();
  }
  nls = (id: string) => {
    return this.props.intl ? this.props.intl.formatMessage({ id: id, defaultMessage: defaultMessages[id] }) : id;
  }

  componentDidMount(){
    this.createAPIWidget();
  }

  componentWillUnmount(){
    if(this.measureWidget){
      this.measureWidget.destroy();
      this.measureWidget = null;
    }
  }

  componentDidUpdate(){
    this.setState({
      useLocationTool: this.props.config.locationTool,
      useDistanceTool: this.props.config.distanceTool,
      useAreaTool: this.props.config.areaTool,
    });
  }

  createAPIWidget(){
    if(!this.mapView){
      return;
    }
    if(!this.measureWidget && this.apiWidgetContainer.current){
      this.drawLayer = new GraphicsLayer({id:"DrawGLayer", listMode: "hide"});
      this.pointSymbol = new PictureMarkerSymbol({url:pinIcon, width: 12, height: 20, yoffset: 10});
      this.measureWidget = new Measurement({
        view: this.mapView,
        container: this.apiWidgetContainer.current
      });

      const that = this;
      this.measureWidget.watch("activeWidget", function(evt){
        if(evt && evt.iconClass === "esri-icon-measure-line"){
          let pathColor = utils.convertStringColorToJsAPISymbolColor(that.props.config.pathColor, that.props.theme)
          let hcolor = pathColor, pathPriColor = pathColor;
          hcolor[3] = 0.8;
          pathPriColor[3] = 204;
          evt.viewModel.palette.handleColor = hcolor
          evt.viewModel.palette.pathPrimaryColor = pathPriColor;
          evt.viewModel.palette.pathSecondaryColor = [255, 255, 255, 204];
          evt.viewModel.palette.pathWidth = 4;
          evt.viewModel.palette.handleWidth = 6;
        } else if(evt) {
          let pathColor = utils.convertStringColorToJsAPISymbolColor(that.props.config.pathColor, that.props.theme)
          let fillColor = utils.convertStringColorToJsAPISymbolColor(that.props.config.fillColor, that.props.theme)
          let pColor = pathColor, hColor = pathColor, fColor = fillColor;
          pColor[3] = 0.5
          hColor[3] = 0.8
          fColor[3] = 0.3
          evt.viewModel.palette.pathColor = pColor;
          evt.viewModel.palette.handleColor = hColor;
          evt.viewModel.palette.fillColor = fColor;
          evt.viewModel.palette.handleWidth = 6;
        }
      });
    }
  }

  activeViewChangeHandler = (jimuMapView: JimuMapView) => {
    if (!jimuMapView) return;
    this.mapView = jimuMapView.view;
    jimuMapView.whenJimuMapViewLoaded().then(() => {
      if (this.drawLayer && !this.mapView.map.findLayerById(this.drawLayer.id)) {
        this.mapView.map.add(this.drawLayer);
      };
      this.mapView.map.allLayers.forEach(layer => console.log("🧱 Layer ID:", layer.id));
    });
    this.createAPIWidget();
  }
  areaMeasurement = () => {
    if(this.viewClickHandler){
      this.viewClickHandler.remove();
      this.viewClickHandler = null;
    }
    if(this.state.areaBtnActive){
      this.clearMeasurements();
      this.setState({
        areaBtnActive: false,
        showLocation: false,
        showLocHint: true,
        showLocResults: false
      });
      (document.querySelector(".widget-map.esri-view") as HTMLElement).style.cursor = "default";
      return;
    }
    this.setState({
      showLocation: false,
      showLocHint: false,
      showLocResults: false,
      lineBtnActive: false,
      areaBtnActive: true,
      pointBtnActive: false
    });

    this.measureWidget.activeTool = "area";
    this.measureWidget.areaUnit = this.props.config.defaultAreaUnit as __esri.units.SystemOrAreaUnit;

    // 🧠 Hook for segment labeling
    const handler = this.measureWidget.watch("measurement", (measurement) => {
      if (measurement?.geometry?.type === "polygon") {
        this.labelPolygonSegments(measurement.geometry as Polygon);
        console.log("Polygon measured:", measurement.geometry);
        handler.remove();
      }
    });
  }

  labelPolygonSegments = (polygon: Polygon) => {
    const unit = this.props.config.defaultLengthUnit || "meters";

    polygon.rings.forEach((ring) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const start = ring[i];
        const end = ring[i + 1];

        const segmentLine = new Polyline({
          paths: [[start, end]],
          spatialReference: polygon.spatialReference
        });

        const length = geometryEngine.geodesicLength(segmentLine, unit);
        const label = `${length.toFixed(2)} ${unit}`;

        const midPoint = {
          x: (start[0] + end[0]) / 2,
          y: (start[1] + end[1]) / 2,
          spatialReference: polygon.spatialReference
        };

        const textSymbol = new TextSymbol({
          text: label,
          color: "black",
          haloColor: "white",
          haloSize: "1px",
          font: { size: 12, family: "Arial" },
          yoffset: 10
        });

        const graphic = new Graphic({
          geometry: midPoint,
          symbol: textSymbol
        });

        this.drawLayer.add(graphic);
      }
    });
  }
  pointMeasurement = () => {
    if(this.state.pointBtnActive){
      this.setState({
        pointBtnActive: false,
        showLocation: false,
        showLocHint: true,
        showLocResults: false
      });
      (document.querySelector(".widget-map.esri-view") as HTMLElement).style.cursor = "default";
      if(this.viewClickHandler){
        this.viewClickHandler.remove();
        this.viewClickHandler = null;
      }
      this.drawLayer.removeAll();
      return;
    }
    this.measureWidget.clear();
    this.setState({
      showLocation: true,
      showLocHint: true,
      showLocResults: false,
      lineBtnActive: false,
      areaBtnActive: false,
      pointBtnActive: true
    });
    (document.querySelector(".widget-map.esri-view") as HTMLElement).style.cursor = "crosshair";
    this.viewClickHandler = this.mapView.on('click', (event) => {
      event.stopPropagation();
      this.setState({
        showLocation: true,
        showLocHint: false,
        showLocResults: true,
        y: event.mapPoint.latitude,
        x: event.mapPoint.longitude
      });
      this.setLocationValue();
      var g = new Graphic({geometry:event.mapPoint, symbol: this.pointSymbol});
      this.drawLayer.removeAll();
      this.drawLayer.add(g);
    });
  }

  distanceMeasurement = () => {
    if(this.viewClickHandler){
      this.viewClickHandler.remove();
      this.viewClickHandler = null;
    }
    if(this.state.lineBtnActive){
      this.clearMeasurements();
      this.setState({
        lineBtnActive: false,
        showLocation: false,
        showLocHint: true,
        showLocResults: false
      });
      (document.querySelector(".widget-map.esri-view") as HTMLElement).style.cursor = "default";
      return;
    }
    this.setState({
      showLocation: false,
      showLocHint: false,
      showLocResults: false,
      lineBtnActive: true,
      areaBtnActive: false,
      pointBtnActive: false
    });
    this.measureWidget.activeTool = "distance";
    this.measureWidget.linearUnit = this.props.config.defaultLengthUnit as __esri.units.SystemOrLengthUnit;
  }

  clearMeasurements = () => {
    this.setState({
      showLocation: false,
      lineBtnActive: false,
      areaBtnActive: false,
      pointBtnActive: false
    });
    this.measureWidget.clear();
    (document.querySelector(".widget-map.esri-view") as HTMLElement).style.cursor = "default";
    if(this.viewClickHandler){
      this.viewClickHandler.remove();
      this.viewClickHandler = null;
    }
    this.drawLayer.removeAll();
  }
  locUnitChange = (evt) => {
    const value = evt?.target?.value;
    const wkid = evt?.target?.options[evt?.target?.selectedIndex]?.dataset?.wkid || 0;
    this.setState({cs: value, csWKID: parseInt(wkid)}, ()=> this.setLocationValue());
  }

  setLocationValue= () => {
    if(this.state.cs === 'DMS'){
      this.setState({xyStr: this.deg_to_dms(this.state.y, false) + ", " + this.deg_to_dms(this.state.x, true), locationStr: "Location (Lat, Lon)"});
    }else if(this.state.cs === 'CUSTOM'){
      var projParams = new ProjectParameters();
      projParams.geometries = [new Point({latitude: this.state.y, longitude: this.state.x})];
      projParams.outSpatialReference = new SpatialReference({wkid:this.state.csWKID});
      GeometryService.project(esriConfig.geometryServiceUrl, projParams).then(results=>{
        const rPnt = results[0] as Point;
        this.setState({xyStr: rPnt.x.toFixed(6) + ", " + rPnt.y.toFixed(6), locationStr: "Location (X, Y)"});
      });
    }else if(this.state.cs === 'DEG'){
      this.setState({xyStr: this.state.y.toFixed(6) + ", " + this.state.x.toFixed(6), locationStr: "Location (Lat, Lon)"});
    }
  }

  deg_to_dms = (deg: number, lng: boolean): string => {
    var d = parseInt(deg.toString());
    var minfloat = Math.abs((deg - d) * 60);
    var m = Math.floor(minfloat);
    var secfloat = (minfloat - m) * 60;
    var s = Math.round((secfloat + Number.EPSILON) * 100) / 100
    d = Math.abs(d);
    if (s == 60) { m++; s = 0; }
    if (m == 60) { d++; m = 0; }
    let dms = {
      dir: deg < 0 ? lng ? 'W' : 'S' : lng ? 'E' : 'N',
      deg: d, min: m, sec: s
    };
    return `${dms.deg}\u00B0 ${dms.min}' ${dms.sec}" ${dms.dir}`
 }

  getLocationOptions = (): JSX.Element[] => {
    const optionsArray = [];
    this.props.config.locationOptions.map((loc) =>{
      optionsArray.push(<option data-wkid={loc.wkid} value={loc.type}>{loc.label}</option>);
    });
    return optionsArray;
  }

  render() {
    const useMapWidget = this.props.useMapWidgetIds &&
                        this.props.useMapWidgetIds[0]
    const {config} = this.props;
    const {showLocation, showLocHint, showLocResults, xyStr, locationStr, areaBtnActive, lineBtnActive, pointBtnActive,
      useLocationTool, useDistanceTool, useAreaTool} = this.state;
    if(!useMapWidget){
      return <div className='widget-measure jimu-widget' css={getStyle(this.props.theme, config)}>
        <WidgetPlaceholder icon={measureIcon} autoFlip message={this.props.intl.formatMessage({ id: '_widgetLabel', defaultMessage: defaultMessages._widgetLabel })} widgetId={this.props.id} />
      </div>
    }

    return <div className="widget-measure jimu-widget" css={getStyle(this.props.theme, config)}>
      {useMapWidget && (
          <JimuMapViewComponent
            useMapWidgetId={this.props.useMapWidgetIds?.[0]}
            onActiveViewChange={this.activeViewChangeHandler}
          />
      )}
      <div id="toolbarDiv" className="esri-component esri-widget">
        <div className="measureToolbarDiv">
          {useLocationTool && 
            <Button className='esri-icon-map-pin' size='sm' type={'default'} active={pointBtnActive}
              onClick={this.pointMeasurement} title={this.nls('pointMeasureTool')}></Button>
          }
          {useDistanceTool &&
            <Button className='esri-icon-measure-line' size='sm' type={'default'} active={lineBtnActive}
              onClick={this.distanceMeasurement} title={this.nls('distMeasureTool')}></Button>
          }
          {useAreaTool && 
            <Button className='esri-icon-measure-area' size='sm' type={'default'} active={areaBtnActive}
             onClick={this.areaMeasurement} title={this.nls('areaMearureTool')}></Button>
          }
          <Button className='esri-icon-trash' size='sm' type={'default'}
            onClick={this.clearMeasurements} title={this.nls('clearMeasure')}></Button>
        </div>
      </div>
      <div className='esri-measurement' ref={this.apiWidgetContainer}></div>
      {showLocation && 
        <div className='esri-measurement' ref={this.locationDiv}>
          <div className='esri-distance-measurement-2d esri-widget esri-widget--panel'>
            <div className="esri-distance-measurement-2d__container">
              {showLocHint &&
                <section className="esri-distance-measurement-2d__hint">
                  <p className="esri-distance-measurement-2d__hint-text">Click on the map to display the location</p>
                </section>
              }
              {showLocResults &&
                <div>
                  <div className="esri-distance-measurement-2d__settings">
                    <section className="esri-distance-measurement-2d__units">
                      <label className="esri-distance-measurement-2d__units-label">Unit</label>
                      <div className="esri-distance-measurement-2d__units-select-wrapper">
                        <select className="esri-distance-measurement-2d__units-select esri-select" onChange={this.locUnitChange}>
                          {this.getLocationOptions()}
                        </select>
                      </div>
                    </section>
                  </div>
                  <section className="esri-distance-measurement-2d__measurement">
                    <div className="esri-distance-measurement-2d__measurement-item">
                      <span className="esri-distance-measurement-2d__measurement-item-title">{locationStr}</span>
                      <span className="esri-distance-measurement-2d__measurement-item-value">{xyStr}</span>
                    </div>
                  </section>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>;
  }
}

