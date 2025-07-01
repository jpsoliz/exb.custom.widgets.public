import { ThemeVariables, css, SerializedStyles } from 'jimu-core';
import { IMConfig } from '../../config';

export function getStyle(theme: ThemeVariables, widgetConfig: IMConfig): SerializedStyles {

  const root = theme.surfaces[1].bg;

  return css`
  overflow: auto;
  .widget-measure {
    width: 100%;
    height: 100%;
    background-color: ${root};
  }

  .measureToolbarDiv button {
    margin: 0 4px 0 4px;
  }

  #toolbarDiv {
    padding: 12px;
  }

  .esri-measurement {
    top: 60px;
    position: absolute;
    width: calc(100% - 0.5rem);
  }
  `
}