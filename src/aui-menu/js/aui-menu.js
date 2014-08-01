/**
 * The Menu Component
 *
 * @module aui-menu
 */

var CSS_DROPDOWN_MENU = A.getClassName('dropdown', 'menu'),
    CSS_MENU_INLINE = A.getClassName('menu', 'inline'),
    CSS_MENU_ITEM = A.getClassName('menu', 'item'),

    EVENT_ITEM_SELECTED = 'itemSelected',

    LAYOUT_INLINE = 'inline',
    LAYOUT_OVERLAY = 'overlay',

    MIN_OVERLAY_VIEWPORT_WIDTH = 768;

/**
 * Fired when one of the menu's items is clicked.
 *
 * @event itemSelected
 * @preventable _defItemSelected
 */

/**
 * A base class for Menu.
 *
 * @class A.Menu
 * @extends Widget
 * @uses A.WidgetPosition, A.WidgetPositionAlign, A.WidgetPositionConstrain,
 *     A.WidgetStack
 * @param {Object} config Object literal specifying widget configuration
 *     properties.
 * @constructor
 */

A.Menu = A.Base.create('menu', A.Widget, [
    A.WidgetPosition,
    A.WidgetPositionAlign,
    A.WidgetPositionConstrain,
    A.WidgetStack
], {

    /**
     * Constructor implementation. Lifecycle.
     *
     * @method initializer
     * @protected
     */
    initializer: function() {
        this._eventHandles = [
            this.after({
                itemsChange: this._afterItemsChange,
                layoutModeChange: this._afterLayoutModeChange,
                'menu-item:shortcut': this._afterShorcut,
                'menu-item:submenuItemSelected': this._afterSubmenuItemSelected
            }),
            A.on(this._onUISetXY, this, '_uiSetXY'),
            this.get('contentBox').delegate('click', this._onClickItem, '> .' + CSS_MENU_ITEM, this),
            this.get('contentBox').delegate('mouseenter', this._onMouseEnterItem, '> .' + CSS_MENU_ITEM, this),
            A.after('windowresize', A.bind(this._afterWindowResize, this))
        ];

        this.publish({
            itemSelected: {
                defaultFn: this._defItemSelected
            }
        });

        this._showItemSubmenuDebounce = A.debounce(
            this._showItemSubmenu,
            A.Menu.HIDE_SUBMENU_DELAY,
            this
        );
    },

    /**
     * Destructor implementation. Lifecycle.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {
        var items = this.get('items');

        for (var i = 0; i < items.length; i++) {
            items[i].destroy();
        }

        (new A.EventHandle(this._eventHandles)).detach();
    },

    /**
     * Render the Menu component instance. Lifecycle.
     *
     * @method renderUI
     * @protected
     */
    renderUI: function() {
        this._uiSetItems(this.get('items'));

        this.get('contentBox').addClass(CSS_DROPDOWN_MENU);
    },

    /**
     * Syncs the UI. Lifecycle.
     *
     * @method syncUI
     * @protected
     */
    syncUI: function() {
        this._updateLayoutMode();
    },

    /**
     * Returns the `A.MenuItem` instance for the given node.
     *
     * @method _getMenuItemFromNode
     * @param {Node} itemNode
     * @return {Node}
     */
    getMenuItemFromNode: function(itemNode) {
        return itemNode.getData('menu-item');
    },

    /**
     * Hides all the currently open submenus.
     *
     * @method hideAllSubmenus
     */
    hideAllSubmenus: function() {
        var items = this.get('items');

        for (var i = 0; i < items.length; i++) {
            this._hideItemSubmenu(items[i]);
        }
    },

    /**
     * Fired after the `items` attribute changes.
     *
     * @method _afterItemsChange
     * @param {EventFacade} event
     * @protected
     */
    _afterItemsChange: function(event) {
        for (var i = 0; i < event.prevVal.length; i++) {
            event.prevVal[i].removeTarget(this);
        }

        this._uiSetItems(this.get('items'));
    },

    /**
     * Fired after the `layoutMode` attribute changes.
     *
     * @method _afterLayoutModeChange
     * @protected
     */
    _afterLayoutModeChange: function() {
        var layoutMode = this.get('layoutMode');

        this.get('boundingBox').toggleClass(CSS_MENU_INLINE, layoutMode === LAYOUT_INLINE);

        if (this.get('layoutMode') === LAYOUT_OVERLAY) {
            // Hide all submenus if we're starting to use the overlay layout, since
            // they should only show up when hovering over an item.
            this.hideAllSubmenus();
        }
    },

    /**
     * Fired after the `shortcut` event is triggered.
     *
     * @method _afterShorcut
     * @param {EventFacade} event
     * @protected
     */
    _afterShorcut: function(event) {
        this._selectItem(event.target, event.type);
    },

    /**
     * Fired after the `submenuItemSelected` event is triggered.
     *
     * @method _afterSubmenuItemSelected
     * @param {EventFacade} event
     * @protected
     */
    _afterSubmenuItemSelected: function(event) {
        this._selectItem(event.item, event.src);
    },

    /**
     * Fired after the `windowresize` event.
     *
     * @method _afterWindowResize
     * @protected
     */
    _afterWindowResize: function() {
        this._updateLayoutMode();
    },

    /**
     * Default behavior for the `itemSelected` event.
     *
     * @method _defItemSelected
     * @protected
     */
    _defItemSelected: function() {
        if (this.get('layoutMode') === LAYOUT_OVERLAY) {
            this.hideAllSubmenus();
        }
    },

    /**
     * Hides the submenu for the given menu item, if there is one.
     *
     * @method _hideItemSubmenu
     * @param {MenuItem} item
     * @protected
     */
    _hideItemSubmenu: function(item) {
        item.hideSubmenu();
        this._openSubmenuItem = null;
    },

    /**
     * Fired when a menu item is clicked.
     *
     * @method _onClickItem
     * @param {EventFacade} event
     * @protected
     */
    _onClickItem: function(event) {
        var item = this.getMenuItemFromNode(event.currentTarget);

        if (this.get('layoutMode') === LAYOUT_INLINE) {
            if (item.isSubmenuOpen()) {
                this._hideItemSubmenu(item);
            }
            else {
                this._showItemSubmenu(item);
            }
        }

        this._selectItem(item, event.type);

        event.stopPropagation();
    },

    /**
     * Fired when the mouse enters a menu item.
     *
     * @method _onMouseEnterItem
     * @param {EventFacade} event
     * @protected
     */
    _onMouseEnterItem: function(event) {
        var item = this.getMenuItemFromNode(event.currentTarget);

        if (this.get('layoutMode') === LAYOUT_OVERLAY) {
            this._showItemSubmenuDebounce(item);
        }
    },

    /**
     * Fired before the `_uiSetXY` method runs.
     *
     * @method _onUISetXY
     * @protected
     */
    _onUISetXY: function() {
        if (this.get('layoutMode') === LAYOUT_INLINE) {
            // Prevent setting `xy` on inline mode, as we want static positioning
            // in that case.
            return new A.Do.Prevent();
        }
    },

    /**
     * Fires the `itemSelected` event for the given item, unless it's not selectable.
     *
     * @method _selectItem
     * @param {A.MenuItem} item
     * @protected
     */
    _selectItem: function(item, src) {
        if (item.isSelectable()) {
            this.fire(EVENT_ITEM_SELECTED, {
                item: item,
                src: src
            });
        }
    },

    /**
     * Sets the `items` attribute.
     *
     * @method _setItems
     * @param {Array} val
     * @protected
     */
    _setItems: function(val) {
        var items = [];

        if (A.instanceOf(val, A.NodeList)) {
            val.each(function() {
                items.push(A.MenuItem.createFromNode(this));
            });
        }
        else {
            for (var i = 0; i < val.length; i++) {
                if (!A.instanceOf(val[i], A.MenuItem)) {
                    items.push(new A.MenuItem(val[i]));
                }
                else {
                    items.push(val[i]);
                }
            }
        }

        for (var i = 0; i < items.length; i++) {
            items[i].addTarget(this);
        }

        return items;
    },

    /**
     * Shows the submenu for the given menu item, if there is one.
     *
     * @method _showItemSubmenu
     * @param {MenuItem} item
     * @protected
     */
    _showItemSubmenu: function(item) {
        if (this._openSubmenuItem) {
            this._hideItemSubmenu(this._openSubmenuItem);
        }

        item.showSubmenu(this.get('layoutMode') === LAYOUT_OVERLAY, this.get('zIndex') + 1);
        this._openSubmenuItem = item;
    },

    /**
     * Updates the UI according to the value of the `items` attribute.
     *
     * @method _uiSetItems
     * @param {Array} items
     * @protected
     */
    _uiSetItems: function(items) {
        var contentBox = this.get('contentBox');

        contentBox.empty();
        for (var i = 0; i < items.length; i++) {
            contentBox.append(items[i].get('node'));
        }
    },

    /**
     * Updates the layout mode according to the size of the viewport.
     *
     * @method _updateLayoutMode
     * @protected
     */
    _updateLayoutMode: function() {
        if (A.DOM.viewportRegion().width < MIN_OVERLAY_VIEWPORT_WIDTH) {
            this._set('layoutMode', LAYOUT_INLINE);
        }
        else {
            this._set('layoutMode', LAYOUT_OVERLAY);
        }
    }
}, {
    /**
     * Static property used to define the default attribute configuration.
     *
     * @property ATTRS
     * @type Object
     * @static
     */
    ATTRS: {
        /**
         * Information about the items that should be inside the menu.
         *
         * @attribute items
         * @type Array
         */
        items: {
            lazyAdd: false,
            setter: '_setItems',
            validator: function(val) {
                return A.Lang.isArray(val) || A.instanceOf(val, A.NodeList);
            },
            value: []
        },

        /**
         * The layout mode of the menu. Can be either overlay (default) or
         * inline.
         *
         * @attribute layoutMode
         * @type String
         */
        layoutMode: {
            readOnly: true,
            validator: A.Lang.isString,
            value: LAYOUT_OVERLAY
        }
    },

    /**
     * Static property provides a string to identify the CSS prefix.
     *
     * @property CSS_PREFIX
     * @type String
     * @static
     */
    CSS_PREFIX: A.getClassName('menu'),

    /**
     * Static property provides the delay value (in ms) for hiding submenus.
     *
     * @property HIDE_SUBMENU_DELAY
     * @type Number
     * @static
     */
    HIDE_SUBMENU_DELAY: 200,

    /**
     * Object hash, defining how attribute values have to be parsed from markup.
     *
     * @property HTML_PARSER
     * @type Object
     * @static
     */
    HTML_PARSER: {
        items: ['> .' + CSS_MENU_ITEM]
    }
});