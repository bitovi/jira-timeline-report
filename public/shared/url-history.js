import { StacheElement, type } from "../can.js";

function getSavedSettings(){
    const json = localStorage.getItem("savedSettings") || "[]";
    try {
        const data = JSON.parse(json);
        return data.map( datum => {
            return {...datum, search: new URLSearchParams(datum.search)};
        } );
    } catch (e) {
        localStorage.removeItem("savedSettings")
        return [];
    }
}
// this doesn't work deep for now
function areSearchParamsEqual(params1, params2) {
    const keys1 = [...params1.keys()].sort();
    const keys2 = [...params2.keys()].sort();
  
    if (keys1.length !== keys2.length) return false;
  
    for (let key of keys1) {
      if (params1.get(key) !== params2.get(key)) {
        return false;
      }
    }
    return true;
  }

function addSavedSetting(searchParams, name){
    const saved = getSavedSettings();
    const index = saved.findIndex( (saved)=> areSearchParamsEqual(searchParams, saved.search) );
    if(index >= 0) {
        saved.splice(index, 1);
    }
    saved.unshift({name, search: searchParams});
    if(saved.length > 10) {
        saved.splice(10)
    }
    updateSavedSettings(saved);
}
function updateSavedSettings(saved){
    const jsonable = saved.map( searchParams => {
        return {...searchParams, search: searchParams.search.toString() };
    } );
    const json = JSON.stringify(jsonable);
    localStorage.setItem("savedSettings", json);
}
function deleteSavedSetting(index) {
    const current = getSavedSettings();
    if(index >= 0) {
        current.splice(index, 1);
    }
    updateSavedSettings(current);
}

function makeDefaultSavedSetting(index){
    const current = getSavedSettings();
    current.forEach((setting)=>{
        delete setting.isDefault;
    })
    current[index].isDefault = true;
    updateSavedSettings(current);
}

function getDefaultConfigurationName() {
    const numbers = [];
    const savedConfigurations = getSavedSettings();
    for(let {name} of savedConfigurations ) {
        const results = name.match(/^My Configuration(?: (\d+))?$/ )
        if(results) {
            if(results[1] !== undefined) {
                numbers[+results[1]] = true;
            } else {
                numbers[0] = true;
            }
        }
    }
    if(numbers.length === 0) {
        return "My Configuration"
    } else {
        return "My Configuration "+numbers.length;
    }
}


function onPushstate(callback){
    (function(history){
        var pushState = history.pushState;
        history.pushState = function(state) {
            callback && callback();
            return pushState.apply(history, arguments);
        };
    })(window.history);
    // a bad form of teardown ...
    return ()=> {
        callback = null;
    }
}

export default class UrlHistory extends StacheElement {
    static view = `
        <div class="flex align-baseline justify-between">
            <h3 class="h3">Saved Configurations</h3>
            <div class="mt-8">
                <button class="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded inline-flex items-center" on:click="this.saveCurrentConfiguration()">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 inline-block">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg> Save current configuration
                </button>
            </div>
        </div>
       {{# eq(this.availableConfigurations.length , 0) }}
        <p>There are no saved configurations.</p>
       {{ else }}
        <div class="grid gap-2 my-2" style="grid-template-columns: auto auto;">
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 1 / span 1; grid-row: 1 / span 1;">Name</div>   
            <!--<div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">Default Configuration</div>-->
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">Delete</div>
            <div class="border-b-2 border-neutral-40" style="grid-column: 1 / span 2; grid-row: 1 / span 1;"></div>
            {{# for(configuration of this.availableConfigurations) }}

                <div>
                    <a href="?{{configuration.search.toString()}}" class="link">{{ configuration.name }}</a>
                </div>
                <!--<div>
                    <input type="radio" checked:from="configuration.isDefault" on:click="this.makeDefault(scope.index)">
                </div> -->
                <div>
                    <button on:click="this.deleteConfiguration(scope.index)">❌</button>
                </div>

            {{/ for }}
        </div>
        {{/ eq }}
   
    `;
    static props = {
        availableConfigurations: {
            value({resolve, listenTo}) {
                resolve( getSavedSettings() );
                listenTo("updated", ()=> {
                    resolve( getSavedSettings() );
                })
            }
        },
        get defaultSearch(){
            const defaultConfig = this.availableConfigurations.find( config => config.isDefault );
            return defaultConfig?.search;
        }
        /*availableOptions: {
            value({listenTo, resolve}) {
                resolve( getSavedSettings() );

                let timer;
                // no changes after 3 min
                const teardown = onPushstate(()=>{
                    const search = window.location.search;
                    console.log("new search");
                    clearTimeout(search);
                    timer = setTimeout(()=> {
                        console.log("adding", search);
                        addSavedSetting(new URLSearchParams(search));
                        const newValue = getSavedSettings();
                        console.log("resolving", newValue.map( v => v.toString() ))
                        resolve( newValue );
                    }, 3 * 60 * 1000);
                })

                return teardown;
            }
        }*/
    };

    saveCurrentConfiguration(){
        const result = prompt("What do you want to name this configuration?", getDefaultConfigurationName());
        if(result !== null) {
            addSavedSetting(new URLSearchParams(window.location.search), result);
        }
        this.dispatch("updated");
    }
    prettyOptions(options) {
        return options.name;
    }
    deleteConfiguration(index ){
        deleteSavedSetting(index);
        this.dispatch("updated");
    }
    makeDefault(index) {
        makeDefaultSavedSetting(index);
        this.dispatch("updated");
    }
}

customElements.define("url-history", UrlHistory);


