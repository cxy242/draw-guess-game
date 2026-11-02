/* 拾礼：账号绑定适配器。微信全局账号标识只在明确存在时使用。 */
(function(root){'use strict';
 if(typeof root.getShiliOwnerUid==='function')return;
 root.getShiliOwnerUid=function(){return root._wechatUid ? String(root._wechatUid) : null;};
})(window);
