import { React, AllWidgetProps, jsx } from 'jimu-core';
import { JimuMapViewComponent, JimuMapView } from 'jimu-arcgis';
import Sketch from '@arcgis/core/widgets/Sketch';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import geometryEngine from '@arcgis/core/geometry/geometryEngine';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import './widget.css';

export default class MeasureWidget extends React.PureComponent<AllWidgetProps<any>, any> {
  sketch: Sketch;
  graphicsLayer: GraphicsLayer;
  state = {
    jimuMapView: null,
    activeTool: null,
    unit: 'feet',
    areaUnit: 'square-feet',
    resultText: ''
  };

  unitMap = {
    'meters': 'square-meters',
    'kilometers': 'square-kilometers',
    'feet': 'square-feet',
    'yards': 'square-yards',
    'miles': 'square-miles',
    'nautical-miles': 'square-meters',
    'inches': 'square-inches',
    'centimeters': 'square-centimeters',
    'millimeters': 'square-millimeters'
  };

  unitAbbr = {
    'meters': 'm',
    'kilometers': 'km',
    'feet': 'ft',
    'yards': 'yd',
    'miles': 'mi',
    'nautical-miles': 'nmi',
    'inches': 'in',
    'centimeters': 'cm',
    'millimeters': 'mm',
    'square-meters': 'm²',
    'square-kilometers': 'km²',
    'square-feet': 'ft²',
    'square-yards': 'yd²',
    'square-miles': 'mi²',
    'square-inches': 'in²',
    'square-centimeters': 'cm²',
    'square-millimeters': 'mm²'
  };

  activeViewChangeHandler = (jmv: JimuMapView) => {
    this.setState({ jimuMapView: jmv }, () => {
      this.graphicsLayer = new GraphicsLayer();
      jmv.view.map.add(this.graphicsLayer);

      this.sketch = new Sketch({
        view: jmv.view,
        layer: this.graphicsLayer,
        creationMode: 'update',
        visibleElements: {
          createTools: false,
          selectionTools: false,
          settingsMenu: false,
          undoRedoMenu: false,
          toolSettings: false
        },
        snappingOptions: { enabled: true },
        visible: false
      });

      this.sketch.on('create', this.handleSketch);
      this.sketch.on('update', (event) => {
        if (event.state === 'start') {
          const graphicId = event.graphics[0]?.uid;
          this.graphicsLayer.graphics.removeMany(this.graphicsLayer.graphics.filter(g => g.attributes?.label && g.attributes?.source === graphicId));
        }
        if (event.state === 'complete') {
          this.handleSketch({ graphic: event.graphics[0], state: 'complete' });
        }
      });
    });
  };

  handleSketch = (event) => {
    const { graphic } = event;
    if (!graphic || !graphic.geometry) return;

    const graphicId = graphic.uid;
    this.graphicsLayer.graphics.removeMany(this.graphicsLayer.graphics.filter(g => g.attributes?.label && g.attributes?.source === graphicId));

    const geom = graphic.geometry;
    const { unit, areaUnit } = this.state;
    const unitLabel = this.unitAbbr[unit] || unit;
    const areaUnitLabel = this.unitAbbr[areaUnit] || areaUnit;

    let resultText = '';

    if (geom.type === 'polyline') {
      const polyline = geom as Polyline;
      let total = 0;
      polyline.paths.forEach(path => {
        for (let i = 0; i < path.length - 1; i++) {
          const start = path[i], end = path[i + 1];
          const segment = new Polyline({ paths: [[start, end]], spatialReference: polyline.spatialReference });
          const length = geometryEngine.geodesicLength(segment, unit);
          total += length;
          const mid = new Point({ x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2, spatialReference: polyline.spatialReference });
          this.addLabel(mid, `${length.toFixed(2)} ${unitLabel}`, 10, 'normal', graphicId);
        }
      });
      const firstPath = polyline.paths[0];
      const lastPt = firstPath[firstPath.length - 1];
      const endLabelPt = new Point({ x: lastPt[0], y: lastPt[1], spatialReference: polyline.spatialReference });
      this.addLabel(endLabelPt, `Distance: ${total.toFixed(2)} ${unitLabel}`, 14, 'bold', graphicId);
      resultText = `Distance: ${total.toFixed(2)} ${unitLabel}`;
    } else if (geom.type === 'polygon') {
      const polygon = geom as Polygon;
      const area = geometryEngine.geodesicArea(polygon, areaUnit);
      let perimeter = 0;
      polygon.rings.forEach(ring => {
        for (let i = 0; i < ring.length - 1; i++) {
          const start = ring[i], end = ring[i + 1];
          const segment = new Polyline({ paths: [[start, end]], spatialReference: polygon.spatialReference });
          const length = geometryEngine.geodesicLength(segment, unit);
          perimeter += length;
          const mid = new Point({ x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2, spatialReference: polygon.spatialReference });
          this.addLabel(mid, `${length.toFixed(2)} ${unitLabel}`, 10, 'normal', graphicId);
        }
      });
      try {
        const center = polygon.centroid;
        this.addLabel(center, `Area: ${area.toFixed(2)} ${areaUnitLabel}`, 14, 'bold', graphicId);
      } catch (err) {
        console.error("Failed to calculate centroid:", err);
      }
      resultText = `Area: ${area.toFixed(2)} ${areaUnitLabel}, Perimeter: ${perimeter.toFixed(2)} ${unitLabel}`;
    }

    this.setState({ resultText });
  };

  addLabel = (point: Point, text: string, fontSize: number = 11, weight: 'normal' | 'bold' = 'normal', sourceId?: string) => {
    const symbol = new TextSymbol({
      text,
      color: 'white',
      haloColor: 'black',
      haloSize: '1.5px',
      font: { size: fontSize, family: 'Arial', weight },
      yoffset: 10
    });
    const graphic = new Graphic({ geometry: point, symbol, attributes: { label: true, source: sourceId } });
    this.graphicsLayer.add(graphic);
  };

  _handleSketchAction = (action: string) => {
    if (!this.sketch) {
      console.warn('Sketch tool not ready yet.');
      return;
    }

    switch (action) {
      case 'polyline':
        this.sketch.create('polyline');
        break;
      case 'polygon':
        this.sketch.create('polygon');
        break;
      case 'select':
        this.sketch.viewModel.tool = 'select';
        break;
      case 'undo':
        this.sketch.viewModel.undo();
        break;
      case 'redo':
        this.sketch.viewModel.redo();
        break;
      case 'delete':
        this.sketch.delete();
        if (this.graphicsLayer) {
          this.graphicsLayer.removeAll(); // Removes both geometry and label graphics
        }
        this.setState({ resultText: '' });
        break;
      default:
        break;
    }
  };

  _changeUnit = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    this.setState({
      unit: selected,
      areaUnit: this.unitMap[selected] || 'square-meters'
    }, () => {
      if (!this.graphicsLayer) {
        console.warn('Graphics layer not ready yet.');
        return;
      }
      const editableGraphics = this.graphicsLayer.graphics.filter(g => !g.attributes?.label);
      if (editableGraphics.length) {
        this.handleSketch({ graphic: editableGraphics.getItemAt(0), state: 'complete' });
      }
    });
  };

  render() {
    return (
      <div className='widget-measure'>
        <JimuMapViewComponent
          useMapWidgetId={this.props.useMapWidgetIds?.[0]}
          onActiveViewChange={this.activeViewChangeHandler}
        />
        <div className='widget-controls'>
          <div className='custom-toolbar'>
            <button onClick={() => this._handleSketchAction('select')}><img src={require('./assets/select-pin.svg')} alt="Select" /></button>
            <button onClick={() => this._handleSketchAction('polyline')}><img src={require('./assets/measure-line.svg')} alt="Line" /></button>
            <button onClick={() => this._handleSketchAction('polygon')}><img src={require('./assets/measure-area.svg')} alt="Polygon" /></button>
            <button onClick={() => this._handleSketchAction('undo')}><img src={require('./assets/undo.svg')} alt="Undo" /></button>
            <button onClick={() => this._handleSketchAction('redo')}><img src={require('./assets/redo.svg')} alt="Redo" /></button>
            <button onClick={() => this._handleSketchAction('delete')}>Erase</button>
          </div>



          <select onChange={this._changeUnit} value={this.state.unit}>
            <option value='meters'>Meters</option>
            <option value='kilometers'>Kilometers</option>
            <option value='feet'>Feet</option>
            <option value='yards'>Yards</option>
            <option value='miles'>Miles</option>
            <option value='nautical-miles'>Nautical Miles</option>
          </select>

          <div className='results-display'>
            {this.state.resultText && <div>{this.state.resultText}</div>}
          </div> 

        </div>
      </div>
    );
  }
}
