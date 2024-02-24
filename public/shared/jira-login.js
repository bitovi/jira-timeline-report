import { StacheElement, type } from "../can.js";

export default class JiraLogin extends StacheElement {
    static view = `
    {{# if(this.isPending) }}
        <button
            class="p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold"
            style="border: none">
            Connecting
        </button>
    {{ else }}
        {{# if(this.isLoggedIn) }}
            <button
                class="p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold"
                style="border: none"
                on:click="this.logout()">
                Log Out
            </button>
        {{ else }}
            <button
                class="p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold"
                style="border: none"
                on:click="this.login()">
                Connect to Jira
            </button>
        {{/ if }}
    {{/ if }}
    {{# not(this.isResolved) }}

    {{/ not}}

   
    `;
    static props = {
        jiraHelpers: type.Any,
        isLoggedIn: false,
        isResolved: false,
        isPending: true
    };
    login(){
        this.isResolved = false;
        this.isPending = true;
        this.jiraHelpers.getAccessToken().then(()=>{
            this.isLoggedIn = true;
            this.isResolved = true;
            this.isPending = false;
        })
    }
    logout(){
        this.isPending = true;
        localStorage.clear();
        this.isLoggedIn = false;
        this.isResolved = false;
        this.isPending = false;
    }
    connected(){
        
        // imperative is easier here ...

        // if someone had a token, always automatically log them in
        if(this.jiraHelpers.hasAccessToken()) {
            if(this.jiraHelpers.hasValidAccessToken()) {
                this.isLoggedIn = true;
                this.isResolved = true;
                this.isPending = false;
            } else {
                this.jiraHelpers.getAccessToken().then(()=>{
                    this.isLoggedIn = true;
                    this.isResolved = true;
                    this.isPending = false;
                })
            }
        } else {
            this.isLoggedIn = false;
            this.isResolved = true;
            this.isPending = false;
        }
    }
}

customElements.define("jira-login", JiraLogin);


