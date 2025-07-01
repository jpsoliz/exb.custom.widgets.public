import { ImmutableObject } from 'seamless-immutable';

export interface Config {
  locationOptions: locationUnit[];
  locationTool: boolean;
  distanceTool: boolean;
  areaTool: boolean;
  defaultAreaUnit?: "imperial"|"metrics"|"square-millimeters"|"square-centimeters"|"square-decimeters"|"square-meters"|"square-kilometers"|"square-inches"|"square-feet"|"square-yards"|"square-miles"|"square-us-feet"|"acres"|"ares"|"hectares";
  defaultLengthUnit?: "imperial"|"metrics"|"millimeters"|"centimeters"|"decimeters"|"meters"|"kilometers"|"inches"|"feet"|"yards"|"miles"|"nautical-miles"|"us-feet";
  pathColor: string,
  fillColor: string
}

export interface locationUnit {
  id: number;
  label: string;
  type: 'DEG'|'DMS'|'CUSTOM';
  wkid?: number;
}

export type IMConfig = ImmutableObject<Config>;
