module.exports = {

"[project]/src/app/api/repos/route.ts [app-route] (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {
"use strict";

__turbopack_esm__({
    "GET": ()=>GET
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__commonjs__external__fs__ = __turbopack_external_require__("fs", true);
var __TURBOPACK__commonjs__external__path__ = __turbopack_external_require__("path", true);
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
async function GET(request) {
    try {
        // Path to your store directory
        const storeDir = (0, __TURBOPACK__commonjs__external__path__["join"])(process.cwd(), 'store', 'repos');
        // Read all repository directories
        const repoDirs = (0, __TURBOPACK__commonjs__external__fs__["readdirSync"])(storeDir, {
            withFileTypes: true
        }).filter((dirent)=>dirent.isDirectory()).map((dirent)=>dirent.name);
        // For now, just return the list of repositories
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            repositories: repoDirs,
            count: repoDirs.length
        });
    } catch (error) {
        console.error('Error reading repositories:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to load repositories'
        }, {
            status: 500
        });
    }
}

})()),

};

//# sourceMappingURL=src_app_api_repos_route_ts_004c73._.js.map