// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./features/catalog/catalog-list/catalog-list.component').then(
            (m) => m.CatalogListComponent
          ),
      },
      {
        path: 'catalog/:id',
        loadComponent: () =>
          import('./features/catalog/product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent
          ),
      },
      {
        path: 'listings/new',
        loadComponent: () =>
          import('./features/listings/create-listing/create-listing.component').then(
            (m) => m.CreateListingComponent
          ),
      },
      {
        path: 'escrow',
        loadComponent: () =>
          import('./features/escrow/escrow-list/escrow-list.component').then(
            (m) => m.EscrowListComponent
          ),
      },
      {
        path: 'escrow/checkout',
        loadComponent: () =>
          import('./features/escrow/checkout/checkout.component').then(
            (m) => m.CheckoutComponent
          ),
      },
      {
        path: 'escrow/safe-meet/:orderId',
        loadComponent: () =>
          import('./features/escrow/safe-meet/safe-meet.component').then(
            (m) => m.SafeMeetComponent
          ),
      },
      {
        path: 'escrow/video-verify/:orderId',
        loadComponent: () =>
          import('./features/escrow/video-verify/video-verify.component').then(
            (m) => m.VideoVerifyComponent
          ),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'chat/:orderId',
        loadComponent: () =>
          import('./features/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'verify/done',
        loadComponent: () =>
          import('./features/verify/verify-done.component').then((m) => m.VerifyDoneComponent),
      },
      {
        path: '**',
        redirectTo: '',
      },

    ],
  },
];
