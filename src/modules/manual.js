import ModuleComponent from './views/Manual.vue';
import { defineModule } from '@directus/extensions-sdk';
export default defineModule({
	id: 'simple-autosync',
	name: 'Simple Autosync manual actions',
	icon: 'sync',
	
	routes: [
		{
			path: '',
			component: ModuleComponent,
		},
	],
});