/** @jsx jsx */
import {classNames, Immutable, ImmutableObject, React, defaultMessages as jimuCoreMessages,ThemeVariables, 
  SerializedStyles, css, jsx, polished, } from 'jimu-core';
import {AllWidgetSettingProps} from 'jimu-for-builder';
import {IMConfig, locationUnit as locationUnit} from '../config';
import defaultMessages from './translations/default';
import {MapWidgetSelector, SettingSection, SettingRow} from 'jimu-ui/advanced/setting-components';
import {Select, Switch, defaultMessages as jimuUIDefaultMessages, Button, Icon, TextInput} from 'jimu-ui';
import {ColorPicker} from 'jimu-ui/basic/color-picker';
import {Fragment} from 'react'
const prefix = 'jimu-widget-'

export interface State{
  locationEnabled: boolean;
  distanceEnabled: boolean;
  areaEnabled: boolean;
  defaultAreaUnit: any;
  defaultLengthUnit: any;
  activeId: number;
  pathColor: string;
  fillColor: string;
}

export default class Setting extends React.PureComponent<AllWidgetSettingProps<IMConfig>, State> {
  constructor (props) {
    super(props)
    this.state = {
     locationEnabled: true,
     areaEnabled: true,
     distanceEnabled: true,
     defaultAreaUnit: this.props.config.defaultAreaUnit || "imperial",
     defaultLengthUnit: this.props.config.defaultLengthUnit || "imperial",
     activeId: 0,
     pathColor: this.props.config.pathColor || "#ff8000",
     fillColor: this.props.config.fillColor || "#ff8000"
    }
  }

  onMapWidgetSelected = (useMapWidgetsId: string[]) => {
    this.props.onSettingChange({
      id: this.props.id,
      useMapWidgetIds: useMapWidgetsId
    });
  }

  formatMessage = (id: string, values?: { [key: string]: any }) => {
    const messages = Object.assign({}, defaultMessages, jimuUIDefaultMessages, jimuCoreMessages)
    return this.props.intl.formatMessage({ id: id, defaultMessage: messages[id] }, values)
  }

  locationEnabledChange = (evt) => {
    const target = evt.currentTarget;
    this.setState({locationEnabled: target.checked});
    this.onPropertyChange('locationTool', target.checked)
  }

  distanceEnabledChange = (evt) => {
    const target = evt.currentTarget;
    this.setState({distanceEnabled: target.checked});
    this.onPropertyChange('distanceTool', target.checked)
  }

  areaEnabledChange = (evt) => {
    const target = evt.currentTarget;
    this.setState({areaEnabled: target.checked});
    this.onPropertyChange('areaTool', target.checked)
  }

  dAreaChanged = (evt) => {
    const value = evt?.target?.value;
    this.setState({defaultAreaUnit: value});
    this.onPropertyChange('defaultAreaUnit', value);
  }

  dlengthChanged = (evt) => {
    const value = evt?.target?.value;
    this.setState({defaultLengthUnit: value});
    this.onPropertyChange('defaultLengthUnit', value);
  }

  onPropertyChange = (name, value) => {
    const { config } = this.props
    if (value === config[name]) {
      return
    }
    const newConfig = config.set(name, value)
    const alterProps = {
      id: this.props.id,
      config: newConfig
    }
    this.props.onSettingChange(alterProps)
  }

  getAreaOptions = (): JSX.Element[] => {
    const optionsArray = [];
    const areaUnits = ["metric","imperial","square-inches","square-feet","square-yards","square-miles","square-us-feet","square-meters","square-kilometers","acres","ares","hectares"];
    areaUnits.map((val, index) =>{
      optionsArray.push(<option key={index} value={val}>{this.formatMessage(val)}</option>);
    });
    return optionsArray;
  }

  getLengthOptions = (): JSX.Element[] => {
    const optionsArray = [];
    const distanceUnits = ["metric","imperial","inches","feet","yards","miles","nautical-miles","us-feet","meters","kilometers"];
    distanceUnits.map((val, index) =>{
      optionsArray.push(<option key={index} value={val}>{this.formatMessage(val)}</option>);
    });
    return optionsArray;
  }

  getUnitTypeOptions = (): JSX.Element[] => {
    const optionsArray = [];
    const unitTypes = ["DEG","DMS","CUSTOM"];
    unitTypes.map((val, index) =>{
      optionsArray.push(<option key={index} value={val}>{this.formatMessage(val)}</option>);
    });
    return optionsArray;
  }

  addLocUnit = (evt) => {
    if (evt) evt.stopPropagation()
    let { config } = this.props
    const { activeId } = this.state
    const oriLocUnits = config.locationOptions
    const newLocOptions = oriLocUnits.asMutable({ deep: true })
    const newLocOption: locationUnit = {
      id: newLocOptions.length + 1,
      type: 'CUSTOM',
      label: 'Enter label for unit',
      wkid: 4326
    }
    newLocOptions.push(newLocOption);
    const newImmutableArray = Immutable(newLocOptions)
    this.onPropertyChange('locationOptions', newImmutableArray)
    this.setState({
      activeId: newLocOption.id
    })
  }

  handleDelete = (locationUnit: ImmutableObject<locationUnit>, evt?: any) => {
    if (evt) evt.stopPropagation()
    const { id } = locationUnit
    const { activeId } = this.state
    let { config } = this.props
    const oriLocUnits = config.locationOptions
    const index = oriLocUnits.findIndex(x => x.id === id)
    if (index === -1) return
    const newLocOptions = oriLocUnits.asMutable({ deep: true })
    let newEditActiveLocUnit
    newLocOptions.splice(index, 1)
    if (activeId === 0 && newLocOptions.length >= 1) {
      newEditActiveLocUnit = newLocOptions[0]
    }
    const newImmutableArray = Immutable(newLocOptions)
    this.onPropertyChange('locationOptions', newImmutableArray)
  }

  handleSelect = (id: number, locationUnit: ImmutableObject<locationUnit>) => {
    const { activeId } = this.state
    if (activeId === id) {
      this.setState({ activeId: 0 })
      return
    }
    this.setState({ activeId: id })
  }

  onlocUnitChange = (id, newText, key) => {
    const { config } = this.props
    const oriLocOptions = config.locationOptions
    const fixIndex = oriLocOptions.findIndex(x => x.id === id)
    const newLocOption = oriLocOptions.map((item, index) => {
      if (fixIndex === index) {
        if(key === 'wkid'){
          return item.set(key, parseInt(newText))
        }else{
          return item.set(key, newText)
        }
      }
      return item
    })
    this.onPropertyChange('locationOptions', newLocOption)
  }

  handleKeydown = (e, ref) => {
    if (e.keyCode === 13) {
      ref.current.blur()
    }
  }

  settingsColorChange = (color, key) => {
    this.onPropertyChange(key, color);
    if(key === 'fillColor'){
      this.setState({fillColor: color});
    }else{
      this.setState({pathColor: color});
    }
  }

  getStyle = (theme: ThemeVariables): SerializedStyles => {
    return css`
      &.jimu-widget-measurement-setting{
        .measurement-setting {
          display: flex;
          flex-direction: column;
          height: 100%;
          .bookmark-setting-flex {
            flex: 1;
          }
        }
        .setting-location-unit-list {
          width: 100%;
          display: inline-block;
          margin-bottom: ${polished.rem(4)};
          .bookmark-edit-input {
            padding: 3px 0;
          }
        }
        .setting-location-unit-list:hover {
          cursor: pointer;
          background: ${theme.colors.secondary};
          border-left: 2px solid ${theme.colors.primary};
        }
        .active-unit {
          background: ${theme.colors.secondary};
          margin-bottom: 0 !important;
          border: 1px solid ${theme.colors.palette.light[600]};
          border-width: 1px 1px 0;
        }
        .active-unit-content {
          border: 1px solid ${theme.colors.palette.light[600]};
          border-width: 0 1px 1px;
          padding: ${polished.rem(8)};
          margin-bottom: ${polished.rem(4)};
        }
        .header-title-input {
          width: 150px;
        }
        .drop-height {
          .dropdown-button {
            height: ${polished.rem(26)};
          }
        }
      }
    `
  }

  render() {
    const {config} = this.props;
    const {locationEnabled, distanceEnabled, areaEnabled, defaultAreaUnit, defaultLengthUnit, 
      activeId, pathColor, fillColor} = this.state;
    return (
    <div className={classNames(`${prefix}measurement-setting`, `${prefix}setting`)} css={this.getStyle(this.props.theme)}>
      <SettingSection className="map-selector-section" title={this.props.intl.formatMessage({id: 'sourceLabel', defaultMessage: defaultMessages.sourceLabel})}>
        <SettingRow label={this.formatMessage('selectMapWidget')}></SettingRow>
        <SettingRow>
            <MapWidgetSelector onSelect={this.onMapWidgetSelected} useMapWidgetIds={this.props.useMapWidgetIds} />
        </SettingRow>
      </SettingSection >
      <SettingSection className="defaults-section" title={this.formatMessage('defaultsSectionLabel')}>
        <SettingRow label={this.formatMessage('areasUnit')} flow='wrap'>
          <Select style={{display:'inline-block', width:'calc(100% -70px)'}} onChange={this.dAreaChanged}
            className="top-drop" value={defaultAreaUnit}>
            {this.getAreaOptions()}
          </Select>
        </SettingRow>
        <SettingRow label={this.formatMessage('lengthUnit')} flow='wrap'>
          <Select style={{display:'inline-block', width:'calc(100% -70px)'}} onChange={this.dlengthChanged}
            className="top-drop" value={defaultLengthUnit}>
            {this.getLengthOptions()}
          </Select>
        </SettingRow>
      </SettingSection>
      <SettingSection className="tools-section" title={this.formatMessage('toolsSectionLabel')}>
        <SettingRow label={this.formatMessage('locationTool')} flow='no-wrap'>
          <Switch title={this.formatMessage('locationTool')} className="mr-4" onChange={this.locationEnabledChange} checked={locationEnabled} ></Switch>
        </SettingRow>
        <SettingRow label={this.formatMessage('distanceTool')} flow='no-wrap'>
          <Switch title={this.formatMessage('distanceTool')} className="mr-4" onChange={this.distanceEnabledChange} checked={distanceEnabled} ></Switch>
        </SettingRow>
        <SettingRow label={this.formatMessage('areaTool')} flow='no-wrap'>
          <Switch title={this.formatMessage('areaTool')} className="mr-4" onChange={this.areaEnabledChange} checked={areaEnabled} ></Switch>
        </SettingRow>
      </SettingSection>
      <SettingSection className="locationOptions" title={this.formatMessage('locationOptions')}>
        <SettingRow>
          <div className='w-100'>
            <Button className='w-100 text-dark' type="primary" onClick={this.addLocUnit}>{this.formatMessage('AddLoactionUnit')}</Button>
          </div>
        </SettingRow>
        {config.locationOptions && config.locationOptions.length !== 0 &&
          <SettingRow>
            <div className='w-100'>
              {config.locationOptions.map((item, index) => {
                const locUnittypeTextInput = React.createRef<HTMLInputElement>()
                const locUnitLabelTextInput = React.createRef<HTMLInputElement>()
                const locUnitWKIDTextInput = React.createRef<HTMLInputElement>()
                return (
                  <Fragment key={index}>
                    <div className={`$${activeId === item.id ? 'active-unit' : ''} setting-location-unit-list`} onClick={() => this.handleSelect(item.id as number, item)}>
                      <TextInput
                        className='header-title-input h5' ref={locUnitLabelTextInput} size='sm'
                        title={item.label} value={item.label || ''}
                        onChange={evt => this.onlocUnitChange(item.id, evt.target.value, 'label')}
                        onClick={evt => evt.stopPropagation()}
                        onKeyDown={(e) => this.handleKeydown(e, locUnitLabelTextInput)}
                      />
                      <span className='float-right'>
                        <Button title={this.formatMessage('deleteOption')} onClick={(evt) => this.handleDelete(item, evt)} type='tertiary' icon>
                          <Icon icon={require('jimu-ui/lib/icons/delete.svg')} size={12} />
                        </Button>
                      </span>
                    </div>
                    {
                      (activeId === item.id) &&
                        <div className='active-unit-content'>
                          <SettingRow label={this.formatMessage('locationUnitType')} flow='wrap'>
                            <Select onChange={evt => this.onlocUnitChange(item.id, evt.target.value, 'type')} title={item.type} size='sm'
                              className="drop-height" value={item.type || ''}>
                              {this.getUnitTypeOptions()}
                            </Select>
                          </SettingRow>
                          <SettingRow label={this.formatMessage('locationUnitWKID')} flow='wrap'>
                            <TextInput
                              className='header-title-input h5' ref={locUnitWKIDTextInput} size='sm'
                              title={item.wkid.toString()} value={item.wkid || ''}
                              onChange={evt => this.onlocUnitChange(item.id, evt.target.value, 'wkid')}
                              onClick={evt => evt.stopPropagation()}
                              onKeyDown={(e) => this.handleKeydown(e, locUnitWKIDTextInput)}
                            />
                          </SettingRow>
                        </div>
                    }
                  </Fragment>
                )
              })}
            </div>
          </SettingRow>}
      </SettingSection>
      <SettingSection title={this.formatMessage('measureColors')} className='colors-section'>
        <SettingRow label={this.formatMessage('pathColor')} flow='wrap'>
          <ColorPicker className='mr-4 pathcolorpicker' style={{padding: '0'}} width={26} height={26}
            color={pathColor ? pathColor : '#ff8000'}
            onChange={e=>{this.settingsColorChange(e, 'pathColor')}} ></ColorPicker>
        </SettingRow>
        <SettingRow label={this.formatMessage('pathColor')} flow='wrap'>
          <ColorPicker className='mr-4 fillcolorpicker' style={{padding: '0'}} width={26} height={26}
            color={fillColor ? fillColor : '#ff8000'}
            onChange={e=>{this.settingsColorChange(e, 'fillColor')}} ></ColorPicker>
        </SettingRow>
      </SettingSection>
    </div>
    )
  }
}