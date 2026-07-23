import ProductForm from "@/components/admin/ProductForm";
import { createProductAction } from "@/app/actions/products";
import { listBrands } from "@/lib/data/brands.server";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Add Product</h1>
      <div className="mt-6">
        <ProductForm action={createProductAction} brands={listBrands()} />
      </div>
    </div>
  );
}
