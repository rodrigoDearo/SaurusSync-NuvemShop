const conexao = require('node-firebird');
const fs = require ('fs')
const path = require('node:path')
const { app } = require('electron')

const { preparingPostCategory, preparingPostSubCategory } = require('./preparingRequests.js');

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathCategories = path.join(userDataPath, 'categories.json');


async function returnCategoryId(category, subCategory){
    return new Promise(async (resolve, reject) => {
         let categoriesDB = JSON.parse(fs.readFileSync(pathCategories))

         if(!category){ //category name empty
            resolve(null)
         }else
         if(category&&(!subCategory)){ //subcategory name empty but category fill
            let idCategory = categoryExist(categoriesDB, category)
            if(idCategory){ // category already register
                resolve(idCategory)
            }else{ // category not register
                await preparingPostCategory(category)
                .then(async (id) => {
                    resolve(id)
                })
            }
         }else
         if(category&&subCategory){
            let idCategory = categoryExist(categoriesDB, category)
            let idSubCategory = subCategoryExist(categoriesDB, category, subCategory)

            if(idSubCategory){ // subcategory already register
                resolve(idSubCategory)
            }else
            if(idCategory&&(!idSubCategory)){ // just category exist
                await preparingPostSubCategory(category, subCategory, idCategory)
                .then(async (id) => {
                    resolve(id)
                })
            }else
            if((!idCategory)&&(!idSubCategory)){ // anyone exist
                await preparingPostCategory(category)
                .then(async (newIdCategory) => {
                    if(!newIdCategory){
                        resolve()
                    }else{
                        setTimeout(async () => {
                            await preparingPostSubCategory(category, subCategory, newIdCategory)
                            .then(async (id) => {
                                resolve(id)
                            })
                        }, 1500);
                    }
                })

            }
         }
    })
}

function categoryExist(data, category) {
    return data[`${category}`]?.idNuvemShop ?? false;
}

function subCategoryExist(data, category, subCategory) {
    return data[`${category}`]?.subCategories?.[`${subCategory}`] ?? false;
}



module.exports = {
    returnCategoryId
}
