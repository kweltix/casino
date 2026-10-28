import type { ProviderStatus } from '../domain/types';
import type { ProviderEnv,Providers } from './contracts';
import { makeSearchProvider } from './search';
import { makeAnalysisProvider } from './analysis';
import { makeImageProvider } from './images';
export function getProviderStatus(env:ProviderEnv=process.env):ProviderStatus[]{
 const available=!!env.AI_PROVIDER_API_KEY;
 return ['Поиск','Анализ','Референсы'].map(name=>({name,available,reason:available?'Ключ задан; доступ проверяется при запросе':'Добавьте AI_PROVIDER_API_KEY в защищённых настройках среды'}));
}
export function getProviders(env:ProviderEnv=process.env):Providers{return {search:makeSearchProvider(env),analysis:makeAnalysisProvider(env),images:makeImageProvider(env)};}
