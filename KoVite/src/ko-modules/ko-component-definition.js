import {AutoBind} from './ko-auto-bind.js';

/**
 * Class that defines a component for Knockout
 */
export class ComponentDefinition
{
    /** 
     * @type {Map<string, ComponentDefinition>} Map of component definitions, keyed by component name 
     */
    static componentDefinitions = new Map();
    
    /** @type {boolean} Flag to determine if verbose logging is enabled */
    static verbose;
    
    /** @type {string} Name of the module */
    name;
    
    /**
     * @type {function, Class} Class/function to register for any instance of component
     */
    viewModelClass;

    /**
     * @type {AutoBind|null} Settings used by the page loader to automatically bind an instance of component
     */
    autoBind;
    
    /** @type {number} Counts the number of instances created bound via the KO `component` binding */
    instances = 0;
    
    /** @type {number} Counts the number of instances attached via the `attached` binding */
    attached = 0;
    
    /**
     * @param name {String} Component's name
     * @param viewModelClass {function, Class} Class/function to register for any instance of component
     * @param [autoBind] {AutoBind|null} Settings used by the page loader to automatically bind an instance of component
     */
    constructor(name, viewModelClass, autoBind = null)
    {
        this.name = name;
        this.viewModelClass = viewModelClass;
        this.autoBind = autoBind;
    }
    
    /**
     * Factory method to create a view model instance. If an instance is already passed, then it is simply returned. Otherwise,
     * a new instance is created with the passed parameters.
     * @param params {object} Parameters to pass to the view model constructor
     * @param componentInfo {object} Component information, like element, etc.
     */
    createViewModel(params, componentInfo)
    {
        this.instances++;
        
        if (params instanceof this.viewModelClass)
        {
            if (ComponentDefinition.verbose)
                console.log(`Using passed instance of ${this.name} as part of component binding`);

            return params;
        }

        if (ComponentDefinition.verbose)
            console.log(`Creating new instance of ${this.name} as part of component binding`);
        
        let instance = new this.viewModelClass(params);
        return instance;
    }
    
    /**
     * @param viewModelClass {function, Class} Class/function to register for any instance of component
     * @param template {string} HTML template, as a string, associated with this component
     * @param [autoBind] {AutoBind} Optional AutoBind object to use for registration
     */
    static register
    (
        viewModelClass,
        template,
        autoBind
    )
    {
        let name = ComponentDefinition.camelCaseToDash(viewModelClass.name);
        if (ComponentDefinition.componentDefinitions.has(name))
            throw new Error('Component ' + name + ' already registered');

        let definition = new ComponentDefinition(name, viewModelClass, AutoBind.wrap(autoBind))
        definition.name = name;
        definition.viewModelClass = viewModelClass;
        ComponentDefinition.componentDefinitions.set(name, definition);        
        
        ko.components.register(name, 
        {
            viewModel: 
            {
                createViewModel: (params, componentInfo) => definition.createViewModel(params, componentInfo)
            },
            template: template
        });
        
        if (ComponentDefinition.verbose)
            console.log('Registered component ' + name);
    }

    /**
     * Creates an object suitable for passing to the KO `component` binding
     * @returns {{name: string, params: Object, sortIndex: number|null}}
     */
    createBindingObject()
    {
        return { name: this.name, params: this.autoBind.params, sortIndex: this.autoBind.sortIndex };
    }

    /**
     * @returns {boolean} Returns true if there are outstanding instances that have not been attached
     */
    hasOutstanding()
    {
        return this.instances > this.attached;
    }

    /**
     * Checks whether all instances have been attached, and triggers a 'ko.component.definition:loaded' event if they have
     */
    static checkIfComplete()
    {
        // Checks if all instances have been attached
        let components = Array.from(ComponentDefinition.componentDefinitions.values());
        let waiting = components.find(definition => definition.hasOutstanding());
        if (waiting)
            return;

        if (ComponentDefinition.verbose)
            console.log('All components have been attached. Triggered event: ko.component.definition:loaded');
        
        let event = new CustomEvent('ko.component.definition:loaded', { detail: true });
        document.dispatchEvent(event);
    }
    
    /**
     * Updates attached counters and checks whether all instances have been attached
     */
    addAttached()
    {
        this.attached++;
        
        if (ComponentDefinition.verbose)
            console.log(`Attached instance of ${this.name} with attached=${this.attached} of instances=${this.instances}`);
        
        if (this.attached !== this.instances)
            return;

        ComponentDefinition.checkIfComplete();
    }

    static camelCaseToDash(text)
    {
        if (typeof text !== "string" || text.length < 2) return text;
    
        var last = ' ', result = '';
        for (var i = 0; i < text.length; i++)
        {
            var x = text.charAt(i);
            if (last.match(/[A-Za-z]/) && x.match(/[A-Z]/))
                result += '-';
    
            result += x.toLowerCase();
            last = x;
        }
        return result;
    }
    
    static doAttached(element, valueAccessor, allBindings, viewModel)
    {
        if (valueAccessor() === 'parent')
            element = element.parentNode;

        let componentName = ComponentDefinition.camelCaseToDash(viewModel.constructor.name);
        if (!ComponentDefinition.componentDefinitions.has(componentName))
            throw `Component ${componentName} not registered prior to using the 'attached' binding`;

        if (viewModel.attached)
            viewModel.attached(element);  // calls component's attached method
        
        let definition = ComponentDefinition.componentDefinitions.get(componentName);
        definition.addAttached();
    }
    
    static doAttachedHandler(element)
    {
        let handler = valueAccessor();
        handler(element);
    }
}

ko.bindingHandlers.attached = { init: ComponentDefinition.doAttached };
ko.bindingHandlers.attachedHandler = { init: ComponentDefinition.doAttachedHandler };