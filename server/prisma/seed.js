import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seed() {
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.user.deleteMany();

  const juliusomo = await prisma.user.create({
    data: { username: "juliusomo", image: "./images/avatars/image-juliusomo.png" }
  });

  const amyrobson = await prisma.user.create({
    data: { username: "amyrobson", image: "./images/avatars/image-amyrobson.png" }
  });

  const maxblagun = await prisma.user.create({
    data: { username: "maxblagun", image: "./images/avatars/image-maxblagun.png" }
  });

  const ramsesmiron = await prisma.user.create({
    data: { username: "ramsesmiron", image: "./images/avatars/image-ramsesmiron.png" }
  });

  const post1 = await prisma.post.create({
    data: {
      body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer placerat urna vel ante volutpat, ut elementum mi placerat. Phasellus varius nisi a nisl interdum, at ultrices ex tincidunt. Duis nec nunc vel urna ullamcorper eleifend ac id dolor. Phasellus vitae tortor ac metus laoreet rutrum. Aenean condimentum consequat elit, ut placerat massa mattis vitae. Vivamus dictum faucibus massa, eget euismod turpis pretium a. Aliquam rutrum rhoncus mi, eu tincidunt mauris placerat nec. Nunc sagittis libero sed facilisis suscipit. Curabitur nisi lacus, ullamcorper eu maximus quis, malesuada sit amet nisi. Proin dignissim, lacus vitae mattis fermentum, dui dolor feugiat turpis, ut euismod libero purus eget dui.",
      title: "Post 1",
    },
  })
  const post2 = await prisma.post.create({
    data: {
      body: "Proin ut sollicitudin lacus. Mauris blandit, turpis in efficitur lobortis, lectus lacus dictum ipsum, vel pretium ex lacus id mauris. Aenean id nisi eget tortor viverra volutpat sagittis sit amet risus. Sed malesuada lectus eget metus sollicitudin porttitor. Fusce at sagittis ligula. Pellentesque vel sapien nulla. Morbi at purus sed nibh mollis ornare sed non magna. Nunc euismod ex purus, nec laoreet magna iaculis quis. Mauris non venenatis elit. Curabitur varius lectus nisl, vitae tempus felis tristique sit amet.",
      title: "Post 2",
    },
  })


  const comment1 = await prisma.comment.create({
    data: {
      message: "Impressive! Though it seems the drag feature could be improved. But overall it looks incredible. You've nailed the design and the responsiveness at various breakpoints works really well.",
      userId: amyrobson.id,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
      postId: post1.id,
    },
  });

  const comment2 = await prisma.comment.create({
    data: {
      message: "Woah, your project looks awesome! How long have you been coding for? I'm still new, but think I want to dive into React as well soon. Perhaps you can give me an insight on where I can learn React? Thanks!",
      userId: maxblagun.id,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      postId: post1.id,
    },
  });

  const reply1 = await prisma.comment.create({
    data: {
      message: "If you're still new, I'd recommend focusing on the fundamentals of HTML, CSS, and JS before considering React. It's very tempting to jump ahead but lay a solid foundation first.",
      userId: ramsesmiron.id,
      parentId: comment2.id,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      postId: post1.id,
    },
  });

  const reply2 = await prisma.comment.create({
    data: {
      message: "I couldn't agree more with this. Everything moves so fast and it always seems like everyone knows the newest library/framework. But the fundamentals are what stay constant.",
      userId: juliusomo.id,
      parentId: reply1.id,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      postId: post1.id,
    },
  });
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
