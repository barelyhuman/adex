
  import { render, h } from 'preact';
  
  // h() imports will be added at build time since this file is inlined with the client template

const restoreTree = (type, props = {}) => {
  if (typeof props.children === 'object') {
    if (Array.isArray(props.children)) {
      // eslint-disable-next-line no-undef
      return h(
        type,
        props,
        ...props.children.map(x => {
          return restoreTree(x.type, x.props)
        })
      )
    }
    // eslint-disable-next-line no-undef
    return h(
      type,
      props,
      restoreTree(props.children.type, props.children.props || {})
    )
  }
  // eslint-disable-next-line no-undef
  return h(type, props)
}

function mergePropsWithDOM(rootNode, props) {
  const scripts = new Map()
  function walk(node, propPoint) {
    Array.from(node.childNodes || [])
      .filter(x => {
        if (x.localName != 'script') {
          return true
        } else {
          scripts.set(x.src, x)
        }
      })
      .forEach((child, index) => {
        let _prop = propPoint
        if (Array.isArray(propPoint) && propPoint[index]) {
          _prop = propPoint[index]
        }
        if (/^island-(.*)+/.test(child.localName)) {
          _prop.type = child.localName
          if (_prop.props) {
            _prop.props['data-props'] = JSON.stringify(_prop.props)
          }
        }
        if (child.childNodes.length > 0) {
          if (propPoint.children) {
            walk(child, propPoint.children)
          }
        }
      })
  }
  walk(rootNode, props)
  rootNode.innerHTML = ''
  const scriptNodes = [...scripts].map(([k, v]) => v)
  rootNode.append(...scriptNodes)
}


  init()
  
  function init(){
    if(customElements.get("island-counter")){
      return
    }
    customElements.define("island-counter", class IslandCounter extends HTMLElement {
      constructor(){
        super();
      }
    
      async connectedCallback() {
          const c = await import("/Users/sid/code/adex/playground/src/components/counter.tsx");
          const usableComponent = c["Counter"]
          const props = JSON.parse(this.dataset.props  || '{}');
          this.baseProps = props
          this.component = usableComponent
          this.renderOnView({threshold:0.2})              
      }
    
      renderOnView({threshold} = {}){
        const options = {
          root: null,
          threshold,
        };
    
        const self = this;
    
        const callback = function(entries, observer) {
           entries.forEach((entry) => {
            if(!entry.isIntersecting) return
            self.renderIsland()
           });
        }
    
        let observer = new IntersectionObserver(callback, options);
        observer.observe(this);
      }
    
      renderIsland(){
        mergePropsWithDOM(this, this.baseProps);
        render(restoreTree(this.component, this.baseProps), this, undefined)
      }
    })
  }