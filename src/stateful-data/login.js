import { ObservableObject } from "../can";

export class Login extends ObservableObject {
    static props = {
        jiraHelpers: type.Any,
        isLoggedIn: false,
        isResolved: false,
        isPending: true
    };
    constructor(...args){
        super(...args);
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
        this.jiraHelpers.clearAuthFromLocalStorage();
        this.isLoggedIn = false;
        this.isResolved = false;
        this.isPending = false;
    }
}