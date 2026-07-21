import ProductForm from "@/components/admin/ProductForm";
import { createProductAction } from "@/app/actions/products";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Add Product</h1>
      <div className="mt-6">
        <ProductForm action={createProductAction} />
      </div>
    </div>
  );
}
