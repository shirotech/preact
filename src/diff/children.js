import { diff, unmount } from './index';
import { coerceToVNode, Fragment } from '../create-element';
import { EMPTY_OBJ, EMPTY_ARR } from '../constants';
import { removeNode } from '../util';

/**
 * Diff the children of a virtual node
 * @param {import('../internal').PreactElement} parentDom The DOM element whose
 * children are being diffed
 * @param {import('../internal').VNode} newParentVNode The new virtual
 * node whose children should be diff'ed against oldParentVNode
 * @param {import('../internal').VNode} oldParentVNode The old virtual
 * node whose children should be diff'ed against newParentVNode
 * @param {object} context The current context object
 * @param {boolean} isSvg Whether or not this DOM node is an SVG node
 * @param {Array<import('../internal').PreactElement>} excessDomChildren
 * @param {Array<import('../internal').Component>} mounts The list of components
 * which have mounted
 * @param {import('../internal').Component} ancestorComponent The direct parent
 * component to the ones being diffed
 */
export function diffChildren(parentDom, newParentVNode, oldParentVNode, context, isSvg, excessDomChildren, mounts, ancestorComponent) {
	let childVNode, i, j, p, index, oldVNode, newDom,
		nextDom, sibDom, childDom;

	let newChildren = newParentVNode._children || toChildArray(newParentVNode.props.children, newParentVNode._children=[], coerceToVNode);
	let oldChildren = oldParentVNode!=null && oldParentVNode!=EMPTY_OBJ && oldParentVNode._children || EMPTY_ARR;

	let oldChildrenLength = oldChildren.length;

	for (i = 0; i < oldChildrenLength; i++) {
		if (oldChildren[i] && oldChildren[i]._dom) {
			childDom = oldChildren[i]._dom;
			break;
		}
	}

	if (excessDomChildren!=null) {
		for (i = 0; i < excessDomChildren.length; i++) {
			if (excessDomChildren[i]!=null) {
				childDom = excessDomChildren[i];
				break;
			}
		}
	}

	for (i=0; i<newChildren.length; i++) {
		childVNode = newChildren[i] = coerceToVNode(newChildren[i]);
		oldVNode = index = null;

		// Check if we find a corresponding element in oldChildren and store the
		// index where the element was found.
		p = oldChildren[i];

		if (childVNode!=null) {
			if (p != null && (childVNode.key==null && p.key==null ? (childVNode.type === p.type) : (childVNode.key === p.key))) {
				index = i;
			}
			else {
				for (j=0; j<oldChildrenLength; j++) {
					p = oldChildren[j];
					if (p!=null) {
						if (childVNode.key==null && p.key==null ? ((typeof childVNode.type!=='function' || !childVNode.type.prototype.render) && childVNode.type === p.type) : (childVNode.key === p.key)) {
							index = j;
							break;
						}
					}
				}
			}
		}


		// If we have found a corresponding old element we store it in a variable
		// and delete it from the array. That way the next iteration can skip this
		// element.
		if (index!=null) {
			oldVNode = oldChildren[index];
			oldChildren[index] = null;
		}

		nextDom = childDom!=null && childDom.nextSibling;

		// Morph the old element into the new one, but don't append it to the dom yet
		newDom = diff(oldVNode==null ? null : oldVNode._dom, parentDom, childVNode, oldVNode, context, isSvg, excessDomChildren, mounts, ancestorComponent, null);

		// Only proceed if the vnode has not been unmounted by `diff()` above.
		if (childVNode!=null && newDom !=null) {
			if (childVNode._lastDomChild != null) {
				// Only Fragments or components that return Fragment like VNodes will
				// have a non-null _lastDomChild. Continue the diff from the end of
				// this Fragment's DOM tree.
				newDom = childVNode._lastDomChild;
			}
			else if (excessDomChildren==oldVNode || newDom!=childDom || newDom.parentNode==null) {
				// NOTE: excessDomChildren==oldVNode above:
				// This is a compression of excessDomChildren==null && oldVNode==null!
				// The values only have the same type when `null`.

				outer: if (childDom==null || childDom.parentNode!==parentDom) {
					parentDom.appendChild(newDom);
				}
				else {
					sibDom = childDom;
					j = 0;
					while ((sibDom=sibDom.nextSibling) && j++<oldChildrenLength/2) {
						if (sibDom===newDom) {
							break outer;
						}
					}
					parentDom.insertBefore(newDom, childDom);
				}
			}

			childDom = newDom!=null ? newDom.nextSibling : nextDom;
		}
	}

	// Remove children that are not part of any vnode. Only used by `hydrate`
	if (excessDomChildren!=null && newParentVNode.type!==Fragment) for (i=excessDomChildren.length; i--; ) if (excessDomChildren[i]!=null) removeNode(excessDomChildren[i]);

	// Remove remaining oldChildren if there are any.
	for (i=oldChildrenLength; i--; ) if (oldChildren[i]!=null) unmount(oldChildren[i], ancestorComponent);
}

/**
 * Flatten a virtual nodes children to a single dimensional array
 * @param {import('../index').ComponentChildren} children The unflattened
 * children of a virtual node
 * @param {Array<import('../internal').VNode | null>} [flattened] An flat array of children to modify
 * @param {typeof import('../create-element').coerceToVNode} [map] Function that
 * will be applied on each child if the `vnode` is not `null`
 * @param {boolean} [coerceUndef] wether to coerce `undefined` to `null` or not.
 * This is needed for Components without children like `<Foo />`.
 */
export function toChildArray(children, flattened, map, coerceUndef) {
	if (flattened == null) flattened = [];
	if (!coerceUndef && children===undefined) {}
	else if (children==null || typeof children === 'boolean') flattened.push(null);
	else if (Array.isArray(children)) {
		for (let i=0; i < children.length; i++) {
			toChildArray(children[i], flattened, map, true);
		}
	}
	else {
		flattened.push(map ? map(children) : children);
	}

	return flattened;
}
