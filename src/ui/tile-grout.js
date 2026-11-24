/* Existing grout shortcuts open the shared materials draft. */
(function(){
function open(roomId,kind){return FurnishMaterialUI.openTiles({ids:roomId?[roomId]:undefined,kinds:kind?[kind]:undefined});}
const openUnified=(scope={})=>FurnishMaterialUI.openTiles(scope);
window.FurnishTileGroutUI={open,openUnified};
})();
